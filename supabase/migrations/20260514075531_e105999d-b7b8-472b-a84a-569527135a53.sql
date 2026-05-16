
-- Payment transactions for PayHero (STK push deposits + withdrawals)
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  chama_id UUID,
  campaign_id UUID,
  type TEXT NOT NULL CHECK (type IN ('deposit','withdrawal')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  phone TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'payhero',
  provider_reference TEXT,
  external_reference TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','cancelled')),
  raw_response JSONB,
  contribution_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "txn read own or admin" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));

CREATE POLICY "txn insert own" ON public.payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER payment_txn_updated BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_txn_user ON public.payment_transactions(user_id);
CREATE INDEX idx_txn_status ON public.payment_transactions(status);

-- Auto-create notification when a contribution is recorded for a contributor
CREATE OR REPLACE FUNCTION public.notify_on_contribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.contributor_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (
      NEW.contributor_id,
      'Contribution recorded',
      'KES ' || NEW.amount::text || ' recorded' || COALESCE(' (ref ' || NEW.reference || ')',''),
      'success'
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_contribution AFTER INSERT ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_contribution();

-- Notify borrower when loan status changes
CREATE OR REPLACE FUNCTION public.notify_on_loan_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (
      NEW.borrower_id,
      'Loan ' || NEW.status,
      'Your loan of KES ' || NEW.principal::text || ' is now ' || NEW.status,
      CASE WHEN NEW.status='approved' THEN 'success' WHEN NEW.status='rejected' THEN 'error' ELSE 'info' END
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_loan AFTER UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_loan_status();

-- Realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
