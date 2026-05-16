import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAYHERO_BASE = "https://backend.payhero.co.ke/api/v2";

function authHeader() {
  const u = process.env.PAYHERO_API_USERNAME ?? "";
  const p = process.env.PAYHERO_API_PASSWORD ?? "";
  const token = Buffer.from(`${u}:${p}`).toString("base64");
  return `Basic ${token}`;
}

/** STK Push deposit. Records a payment_transactions row, then triggers PayHero STK push. */
export const initiateDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      amount: z.number().positive().max(1_000_000),
      phone: z.string().min(9).max(15),
      chama_id: z.string().uuid().optional(),
      campaign_id: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const externalRef = `VUMA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: txn, error: txnErr } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: userId,
        chama_id: data.chama_id,
        campaign_id: data.campaign_id,
        type: "deposit",
        amount: data.amount,
        phone: data.phone,
        external_reference: externalRef,
        status: "pending",
      })
      .select()
      .single();
    if (txnErr) throw new Error(txnErr.message);

    await supabase.from("audit_logs").insert({
      entity: "payment_transactions", entity_id: txn.id,
      action: "deposit_initiated", actor_id: userId,
      metadata: { amount: data.amount, phone: data.phone, chama_id: data.chama_id ?? null },
    });

    const channelId = process.env.PAYHERO_CHANNEL_ID;
    if (!channelId || !process.env.PAYHERO_API_USERNAME) {
      // Placeholder mode — mark as pending without calling PayHero
      return { ok: true, transaction: txn, mode: "placeholder" as const };
    }

    const origin = process.env.PUBLIC_APP_URL ?? "";
    try {
      const res = await fetch(`${PAYHERO_BASE}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader() },
        body: JSON.stringify({
          amount: data.amount,
          phone_number: data.phone,
          channel_id: Number(channelId),
          provider: "m-pesa",
          external_reference: externalRef,
          callback_url: `${origin}/api/public/payhero-webhook`,
          customer_name: "VUMA User",
        }),
      });
      const body = await res.json().catch(() => ({}));
      await supabase.from("payment_transactions")
        .update({ provider_reference: body?.CheckoutRequestID ?? body?.reference, raw_response: body })
        .eq("id", txn.id);
      if (!res.ok) throw new Error(body?.error_message ?? `PayHero error ${res.status}`);
      return { ok: true, transaction: txn, mode: "live" as const };
    } catch (e) {
      await supabase.from("payment_transactions")
        .update({ status: "failed", raw_response: { error: String(e) } })
        .eq("id", txn.id);
      throw e;
    }
  });

/** Withdrawal — placeholder. Real implementation requires PayHero B2C/withdraw endpoint. */
export const initiateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      amount: z.number().positive().max(1_000_000),
      phone: z.string().min(9).max(15),
      chama_id: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const externalRef = `VUMA-W-${Date.now()}`;
    const { data: txn, error } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: userId,
        chama_id: data.chama_id,
        type: "withdrawal",
        amount: data.amount,
        phone: data.phone,
        external_reference: externalRef,
        status: "pending",
      })
      .select().single();
    if (error) throw new Error(error.message);
    return { ok: true, transaction: txn, mode: "placeholder" as const };
  });
