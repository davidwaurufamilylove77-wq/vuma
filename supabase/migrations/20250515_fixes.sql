-- =====================================================================
-- VUMA Fix Migration — 2025-05-15
-- =====================================================================

-- 1. Add logo_url to chamas table
ALTER TABLE public.chamas ADD COLUMN IF NOT EXISTS logo_url text;

-- 2. Fix profiles RLS — allow chama members to read each other's profiles
-- (needed for member selectors in treasurer dashboard to show names)
DROP POLICY IF EXISTS "profiles read own or admin" ON public.profiles;
CREATE POLICY "profiles read chama members or admin" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.chama_members cm1
      JOIN public.chama_members cm2 ON cm1.chama_id = cm2.chama_id
      WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.id
    )
  );

-- 3. Add chama_id to campaigns if not already set as required
-- (already exists as nullable, just ensuring index exists)
CREATE INDEX IF NOT EXISTS campaigns_chama_id_idx ON public.campaigns(chama_id);

-- 4. Add withdrawal_requests table for proper withdrawal approval flow
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id uuid REFERENCES public.chamas(id),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals read own or treasurer" ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (chama_id IS NOT NULL AND public.is_chama_treasurer(auth.uid(), chama_id)) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "withdrawals insert own" ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "withdrawals update treasurer" ON public.withdrawal_requests FOR UPDATE TO authenticated
  USING ((chama_id IS NOT NULL AND public.is_chama_treasurer(auth.uid(), chama_id)) OR public.has_role(auth.uid(), 'admin'));
