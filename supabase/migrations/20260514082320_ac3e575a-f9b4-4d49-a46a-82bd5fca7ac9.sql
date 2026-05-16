
-- 1. Make chama name searchable + unique (case-insensitive)
ALTER TABLE public.chamas
  ADD COLUMN IF NOT EXISTS search_name text GENERATED ALWAYS AS (lower(btrim(name))) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS chamas_search_name_unique ON public.chamas(search_name);

-- 2. Invite tokens
CREATE TABLE IF NOT EXISTS public.chama_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  expires_at timestamptz,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chama_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites read by treasurer/admin"
  ON public.chama_invites FOR SELECT TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "invites insert by treasurer/admin"
  ON public.chama_invites FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
    AND (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "invites delete by treasurer/admin"
  ON public.chama_invites FOR DELETE TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));

-- 3. Public lookup (RPC) — returns minimal info without exposing the table
CREATE OR REPLACE FUNCTION public.find_chama_by_name(_name text)
RETURNS TABLE(id uuid, name text, member_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, COALESCE(m.cnt, 0) AS member_count
  FROM public.chamas c
  LEFT JOIN (SELECT chama_id, COUNT(*) AS cnt FROM public.chama_members GROUP BY chama_id) m
    ON m.chama_id = c.id
  WHERE c.search_name = lower(btrim(_name))
  LIMIT 1;
$$;

-- 4. Join by name
CREATE OR REPLACE FUNCTION public.join_chama_by_name(_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _chama_id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  SELECT id INTO _chama_id FROM public.chamas WHERE search_name = lower(btrim(_name)) LIMIT 1;
  IF _chama_id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF EXISTS (SELECT 1 FROM public.chama_members WHERE user_id = _uid AND chama_id = _chama_id) THEN
    RETURN jsonb_build_object('status','already_member','chama_id',_chama_id);
  END IF;
  INSERT INTO public.chama_members(chama_id, user_id, role) VALUES (_chama_id, _uid, 'member');
  RETURN jsonb_build_object('status','joined','chama_id',_chama_id);
END $$;

-- 5. Accept invite by token
CREATE OR REPLACE FUNCTION public.accept_chama_invite(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.chama_invites%ROWTYPE; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  SELECT * INTO _inv FROM public.chama_invites WHERE token = _token LIMIT 1;
  IF _inv.id IS NULL THEN RETURN jsonb_build_object('status','invalid'); END IF;
  IF _inv.expires_at IS NOT NULL AND _inv.expires_at < now() THEN
    RETURN jsonb_build_object('status','expired'); END IF;
  IF _inv.max_uses IS NOT NULL AND _inv.uses >= _inv.max_uses THEN
    RETURN jsonb_build_object('status','exhausted'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chama_members WHERE user_id=_uid AND chama_id=_inv.chama_id) THEN
    INSERT INTO public.chama_members(chama_id,user_id,role) VALUES (_inv.chama_id,_uid,'member');
  END IF;
  UPDATE public.chama_invites SET uses = uses + 1 WHERE id = _inv.id;
  RETURN jsonb_build_object('status','joined','chama_id',_inv.chama_id);
END $$;

-- 6. Public preview of an invite (chama name only) so the join page can render before sign-in
CREATE OR REPLACE FUNCTION public.preview_chama_invite(_token text)
RETURNS TABLE(chama_id uuid, chama_name text, expires_at timestamptz, valid boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, i.expires_at,
    (i.expires_at IS NULL OR i.expires_at > now())
      AND (i.max_uses IS NULL OR i.uses < i.max_uses) AS valid
  FROM public.chama_invites i JOIN public.chamas c ON c.id = i.chama_id
  WHERE i.token = _token LIMIT 1;
$$;

-- Allow anonymous access to preview (read-only, leaks only chama name)
GRANT EXECUTE ON FUNCTION public.preview_chama_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_chama_by_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_chama_by_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_chama_invite(text) TO authenticated;

-- 7. Updated handle_new_user — honor signup_role from metadata (treasurer | member only).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'phone');

  _role := CASE
    WHEN NEW.raw_user_meta_data->>'signup_role' = 'treasurer' THEN 'treasurer'::public.app_role
    ELSE 'member'::public.app_role
  END;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
