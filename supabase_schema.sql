-- =====================================================================
-- VUMA — Chama Management Platform
-- Full Postgres schema for Supabase (idempotent reference export)
-- =====================================================================
--
-- This file mirrors the live database created by the project's migrations
-- under supabase/migrations/. It is provided for reference, code review,
-- and standalone deployments. The canonical source of truth is the
-- migrations folder.
--
-- Includes:
--   * app_role enum
--   * Tables: profiles, user_roles, chamas, chama_members, chama_invites,
--             contributions, loans, loan_repayments, campaigns,
--             notifications, payment_transactions, audit_logs
--   * Row-Level Security policies for every table
--   * Helper functions (security definer): has_role, is_chama_member,
--             is_chama_treasurer, find_chama_by_name, join_chama_by_name,
--             accept_chama_invite, preview_chama_invite, handle_new_user,
--             apply_loan_repayment, notify_on_contribution, notify_on_loan_status
--   * Triggers (auth.users, contributions, loans, loan_repayments)
--   * Realtime publication for notifications
-- =====================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','treasurer','member','campaign_owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Helper: timestamp trigger ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ---------- Profiles ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read own or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles insert own"        ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update own"        ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- ---------- User Roles ----------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "roles read own or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin manage"      ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ---------- Chamas ----------
CREATE TABLE IF NOT EXISTS public.chamas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  search_name text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  description text,
  monthly_target numeric DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS chamas_search_name_unique ON public.chamas(search_name);
ALTER TABLE public.chamas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chama_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',  -- 'member' | 'treasurer' | 'admin'
  joined_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chama_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_chama_member(_user_id uuid, _chama_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chama_members WHERE user_id=_user_id AND chama_id=_chama_id);
$$;

CREATE OR REPLACE FUNCTION public.is_chama_treasurer(_user_id uuid, _chama_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chama_members WHERE user_id=_user_id AND chama_id=_chama_id AND role IN ('treasurer','admin'));
$$;

CREATE POLICY "chamas read members or admin" ON public.chamas FOR SELECT TO authenticated
  USING (public.is_chama_member(auth.uid(), id) OR public.has_role(auth.uid(),'admin') OR created_by = auth.uid());
CREATE POLICY "chamas insert authenticated"  ON public.chamas FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "chamas update treasurer or admin" ON public.chamas FOR UPDATE TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "chama_members read self/member/admin" ON public.chama_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chama_member(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "chama_members manage by treasurer/admin" ON public.chama_members FOR ALL TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));

-- ---------- Chama Invites ----------
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
CREATE POLICY "invites read by treasurer/admin"  ON public.chama_invites FOR SELECT TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "invites insert by treasurer/admin" ON public.chama_invites FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "invites delete by treasurer/admin" ON public.chama_invites FOR DELETE TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));

-- ---------- Contributions ----------
CREATE TABLE IF NOT EXISTS public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id uuid,
  campaign_id uuid,
  contributor_id uuid,
  contributor_name text,
  amount numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual',     -- manual | mpesa | bulk | ocr
  reference text,
  status text NOT NULL DEFAULT 'verified',
  notes text,
  recorded_by uuid,
  contributed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contributions read scoped" ON public.contributions FOR SELECT TO authenticated
  USING (
    contributor_id = auth.uid()
    OR (chama_id IS NOT NULL AND public.is_chama_member(auth.uid(), chama_id))
    OR (campaign_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND (c.visibility='public' OR c.owner_id = auth.uid())))
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "contributions insert by treasurer/admin/self" ON public.contributions FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid() AND (
    contributor_id = auth.uid()
    OR (chama_id IS NOT NULL AND public.is_chama_treasurer(auth.uid(), chama_id))
    OR public.has_role(auth.uid(),'admin')
  ));
CREATE POLICY "contributions update by treasurer/admin" ON public.contributions FOR UPDATE TO authenticated
  USING ((chama_id IS NOT NULL AND public.is_chama_treasurer(auth.uid(), chama_id)) OR public.has_role(auth.uid(),'admin'));

-- ---------- Loans ----------
CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  principal numeric NOT NULL,
  interest_rate numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | repaid
  due_date date,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans read borrower/member/admin" ON public.loans FOR SELECT TO authenticated
  USING (borrower_id = auth.uid() OR public.is_chama_member(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "loans insert borrower"            ON public.loans FOR INSERT TO authenticated WITH CHECK (borrower_id = auth.uid());
CREATE POLICY "loans update treasurer/admin"     ON public.loans FOR UPDATE TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL,
  amount numeric NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid
);
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repayments read scoped" ON public.loan_repayments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND
    (l.borrower_id = auth.uid() OR public.is_chama_member(auth.uid(), l.chama_id) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "repayments insert treasurer/admin" ON public.loan_repayments FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.loans l WHERE l.id = loan_id AND
      (public.is_chama_treasurer(auth.uid(), l.chama_id) OR public.has_role(auth.uid(),'admin'))
  ));

CREATE OR REPLACE FUNCTION public.apply_loan_repayment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.loans
    SET balance = GREATEST(0, balance - NEW.amount),
        status = CASE WHEN balance - NEW.amount <= 0 THEN 'repaid' ELSE status END,
        updated_at = now()
  WHERE id = NEW.loan_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_apply_repayment ON public.loan_repayments;
CREATE TRIGGER trg_apply_repayment AFTER INSERT ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.apply_loan_repayment();

-- ---------- Campaigns ----------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  chama_id uuid,
  target_amount numeric NOT NULL DEFAULT 0,
  deadline date,
  visibility text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns read public or member or admin" ON public.campaigns FOR SELECT TO authenticated
  USING (visibility='public' OR owner_id = auth.uid()
    OR (chama_id IS NOT NULL AND public.is_chama_member(auth.uid(), chama_id))
    OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "campaigns insert own"             ON public.campaigns FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "campaigns update owner/treasurer/admin" ON public.campaigns FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()
    OR (chama_id IS NOT NULL AND public.is_chama_treasurer(auth.uid(), chama_id))
    OR public.has_role(auth.uid(),'admin'));

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications read own"   ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_on_contribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.contributor_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (NEW.contributor_id, 'Contribution recorded',
      'KES ' || NEW.amount::text || ' recorded' || COALESCE(' (ref ' || NEW.reference || ')',''),
      'success');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_contribution ON public.contributions;
CREATE TRIGGER trg_notify_contribution AFTER INSERT ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_contribution();

CREATE OR REPLACE FUNCTION public.notify_on_loan_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (NEW.borrower_id, 'Loan ' || NEW.status,
      'Your loan of KES ' || NEW.principal::text || ' is now ' || NEW.status,
      CASE WHEN NEW.status='approved' THEN 'success' WHEN NEW.status='rejected' THEN 'error' ELSE 'info' END);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_loan_status ON public.loans;
CREATE TRIGGER trg_notify_loan_status AFTER UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_loan_status();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ---------- Payment Transactions ----------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chama_id uuid,
  campaign_id uuid,
  contribution_id uuid,
  type text NOT NULL,                       -- deposit | withdrawal
  provider text NOT NULL DEFAULT 'payhero',
  phone text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',   -- pending | success | failed
  external_reference text,
  provider_reference text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn read own or admin" ON public.payment_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "txn insert own"        ON public.payment_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ---------- Audit logs ----------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- =====================================================================
-- Sign-up + chama discovery functions
-- =====================================================================

CREATE OR REPLACE FUNCTION public.find_chama_by_name(_name text)
RETURNS TABLE(id uuid, name text, member_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, COALESCE(m.cnt,0)
  FROM public.chamas c
  LEFT JOIN (SELECT chama_id, COUNT(*) AS cnt FROM public.chama_members GROUP BY chama_id) m
    ON m.chama_id = c.id
  WHERE c.search_name = lower(btrim(_name))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.join_chama_by_name(_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _chama_id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  SELECT id INTO _chama_id FROM public.chamas WHERE search_name = lower(btrim(_name)) LIMIT 1;
  IF _chama_id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF EXISTS (SELECT 1 FROM public.chama_members WHERE user_id=_uid AND chama_id=_chama_id) THEN
    RETURN jsonb_build_object('status','already_member','chama_id',_chama_id);
  END IF;
  INSERT INTO public.chama_members(chama_id,user_id,role) VALUES (_chama_id,_uid,'member');
  RETURN jsonb_build_object('status','joined','chama_id',_chama_id);
END $$;

CREATE OR REPLACE FUNCTION public.accept_chama_invite(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.chama_invites%ROWTYPE; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  SELECT * INTO _inv FROM public.chama_invites WHERE token = _token LIMIT 1;
  IF _inv.id IS NULL THEN RETURN jsonb_build_object('status','invalid'); END IF;
  IF _inv.expires_at IS NOT NULL AND _inv.expires_at < now() THEN RETURN jsonb_build_object('status','expired'); END IF;
  IF _inv.max_uses IS NOT NULL AND _inv.uses >= _inv.max_uses THEN RETURN jsonb_build_object('status','exhausted'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chama_members WHERE user_id=_uid AND chama_id=_inv.chama_id) THEN
    INSERT INTO public.chama_members(chama_id,user_id,role) VALUES (_inv.chama_id,_uid,'member');
  END IF;
  UPDATE public.chama_invites SET uses = uses + 1 WHERE id = _inv.id;
  RETURN jsonb_build_object('status','joined','chama_id',_inv.chama_id);
END $$;

CREATE OR REPLACE FUNCTION public.preview_chama_invite(_token text)
RETURNS TABLE(chama_id uuid, chama_name text, expires_at timestamptz, valid boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, i.expires_at,
    (i.expires_at IS NULL OR i.expires_at > now())
      AND (i.max_uses IS NULL OR i.uses < i.max_uses)
  FROM public.chama_invites i JOIN public.chamas c ON c.id = i.chama_id
  WHERE i.token = _token LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.find_chama_by_name(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_chama_by_name(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_chama_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_chama_invite(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.find_chama_by_name(text)   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.join_chama_by_name(text)   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.accept_chama_invite(text)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.preview_chama_invite(text) TO anon, authenticated;

-- ---------- New-user trigger ----------
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- End of schema
-- =====================================================================
