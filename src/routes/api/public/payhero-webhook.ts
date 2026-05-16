import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * PayHero callback webhook.
 * Configure callback URL in PayHero dashboard to: /api/public/payhero-webhook
 * Optionally set PAYHERO_CALLBACK_SECRET and require it as `?secret=...` query.
 */
export const Route = createFileRoute("/api/public/payhero-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const secret = process.env.PAYHERO_CALLBACK_SECRET;
        if (secret && url.searchParams.get("secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any = {};
        try { payload = await request.json(); } catch {}

        // PayHero sends nested response object — try common shapes
        const r = payload?.response ?? payload;
        const extRef: string | undefined =
          r?.ExternalReference ?? r?.external_reference ?? r?.MerchantRequestID;
        const status: string =
          (r?.Status ?? r?.status ?? "").toString().toLowerCase();
        const providerRef = r?.CheckoutRequestID ?? r?.MpesaReceiptNumber ?? r?.receipt;

        if (!extRef) {
          return new Response(JSON.stringify({ ok: false, reason: "no reference" }), { status: 200 });
        }

        const newStatus =
          status.includes("success") || status === "completed" ? "success"
          : status.includes("cancel") ? "cancelled"
          : status.includes("fail") ? "failed"
          : "pending";

        const { data: txn } = await supabaseAdmin
          .from("payment_transactions")
          .update({ status: newStatus, raw_response: payload, provider_reference: providerRef })
          .eq("external_reference", extRef)
          .select()
          .single();

        // On success, materialize a contribution record
        if (txn && newStatus === "success" && txn.type === "deposit" && !txn.contribution_id) {
          const { data: contrib } = await supabaseAdmin
            .from("contributions")
            .insert({
              chama_id: txn.chama_id,
              campaign_id: txn.campaign_id,
              contributor_id: txn.user_id,
              amount: txn.amount,
              source: "mpesa",
              reference: providerRef ?? extRef,
              status: "verified",
              recorded_by: txn.user_id,
            })
            .select().single();
          if (contrib) {
            await supabaseAdmin.from("payment_transactions")
              .update({ contribution_id: contrib.id }).eq("id", txn.id);
            await supabaseAdmin.from("audit_logs").insert({
              entity: "contributions", entity_id: contrib.id,
              action: "mpesa_deposit_confirmed", actor_id: txn.user_id,
              metadata: { amount: txn.amount, reference: providerRef ?? extRef },
            });
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
