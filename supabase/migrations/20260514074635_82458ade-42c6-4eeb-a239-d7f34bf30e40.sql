
-- ===== ROLES =====
CREATE TYPE public.app_role AS ENUM ('admin', 'treasurer', 'member', 'campaign_owner');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ===== CHAMAS =====
CREATE TABLE public.chamas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  monthly_target NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chamas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chama_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- member|treasurer|admin within chama
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chama_id, user_id)
);
ALTER TABLE public.chama_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_chama_member(_user_id UUID, _chama_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chama_members WHERE user_id = _user_id AND chama_id = _chama_id);
$$;

CREATE OR REPLACE FUNCTION public.is_chama_treasurer(_user_id UUID, _chama_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chama_members WHERE user_id = _user_id AND chama_id = _chama_id AND role IN ('treasurer','admin'));
$$;

-- ===== CAMPAIGNS =====
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID REFERENCES public.chamas(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active|completed|cancelled
  visibility TEXT NOT NULL DEFAULT 'public', -- public|private
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- ===== CONTRIBUTIONS =====
CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID REFERENCES public.chamas(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  contributor_id UUID REFERENCES auth.users(id),
  contributor_name TEXT, -- for non-member entries
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL DEFAULT 'manual', -- manual|mpesa|bulk|ocr
  reference TEXT, -- mpesa code etc.
  status TEXT NOT NULL DEFAULT 'verified', -- pending|verified|rejected
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  contributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contributions_chama ON public.contributions(chama_id);
CREATE INDEX idx_contributions_campaign ON public.contributions(campaign_id);
CREATE INDEX idx_contributions_contributor ON public.contributions(contributor_id);

-- ===== LOANS =====
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES auth.users(id),
  principal NUMERIC(14,2) NOT NULL CHECK (principal > 0),
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|active|repaid|defaulted|rejected
  due_date DATE,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;

-- ===== NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ===== AUDIT LOG =====
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES =====
-- profiles
CREATE POLICY "profiles read own or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "roles read own or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- chamas
CREATE POLICY "chamas read members or admin" ON public.chamas FOR SELECT TO authenticated
  USING (public.is_chama_member(auth.uid(), id) OR public.has_role(auth.uid(),'admin') OR created_by = auth.uid());
CREATE POLICY "chamas insert authenticated" ON public.chamas FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "chamas update treasurer or admin" ON public.chamas FOR UPDATE TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), id) OR public.has_role(auth.uid(),'admin'));

-- chama_members
CREATE POLICY "chama_members read self/member/admin" ON public.chama_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chama_member(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "chama_members manage by treasurer/admin" ON public.chama_members FOR ALL TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));

-- campaigns
CREATE POLICY "campaigns read public or member or admin" ON public.campaigns FOR SELECT TO authenticated
  USING (visibility='public' OR owner_id = auth.uid()
         OR (chama_id IS NOT NULL AND public.is_chama_member(auth.uid(), chama_id))
         OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "campaigns insert own" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "campaigns update owner/treasurer/admin" ON public.campaigns FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR (chama_id IS NOT NULL AND public.is_chama_treasurer(auth.uid(), chama_id)) OR public.has_role(auth.uid(),'admin'));

-- contributions
CREATE POLICY "contributions read scoped" ON public.contributions FOR SELECT TO authenticated
  USING (
    contributor_id = auth.uid()
    OR (chama_id IS NOT NULL AND public.is_chama_member(auth.uid(), chama_id))
    OR (campaign_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND (c.visibility='public' OR c.owner_id = auth.uid())))
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "contributions insert by treasurer/admin/self" ON public.contributions FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by = auth.uid() AND (
      contributor_id = auth.uid()
      OR (chama_id IS NOT NULL AND public.is_chama_treasurer(auth.uid(), chama_id))
      OR public.has_role(auth.uid(),'admin')
    )
  );
CREATE POLICY "contributions update by treasurer/admin" ON public.contributions FOR UPDATE TO authenticated
  USING ((chama_id IS NOT NULL AND public.is_chama_treasurer(auth.uid(), chama_id)) OR public.has_role(auth.uid(),'admin'));

-- loans
CREATE POLICY "loans read borrower/member/admin" ON public.loans FOR SELECT TO authenticated
  USING (borrower_id = auth.uid() OR public.is_chama_member(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "loans insert borrower" ON public.loans FOR INSERT TO authenticated
  WITH CHECK (borrower_id = auth.uid());
CREATE POLICY "loans update treasurer/admin" ON public.loans FOR UPDATE TO authenticated
  USING (public.is_chama_treasurer(auth.uid(), chama_id) OR public.has_role(auth.uid(),'admin'));

-- repayments
CREATE POLICY "repayments read scoped" ON public.loan_repayments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND (l.borrower_id = auth.uid() OR public.is_chama_member(auth.uid(), l.chama_id) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "repayments insert treasurer/admin" ON public.loan_repayments FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND (public.is_chama_treasurer(auth.uid(), l.chama_id) OR public.has_role(auth.uid(),'admin'))));

-- notifications
CREATE POLICY "notifications read own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- audit_logs
CREATE POLICY "audit read admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ===== TRIGGERS =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_chamas_upd BEFORE UPDATE ON public.chamas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_campaigns_upd BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_loans_upd BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default member role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update loan balance on repayment
CREATE OR REPLACE FUNCTION public.apply_loan_repayment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.loans
    SET balance = GREATEST(0, balance - NEW.amount),
        status = CASE WHEN balance - NEW.amount <= 0 THEN 'repaid' ELSE status END,
        updated_at = now()
  WHERE id = NEW.loan_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_loan_repay AFTER INSERT ON public.loan_repayments
FOR EACH ROW EXECUTE FUNCTION public.apply_loan_repayment();
