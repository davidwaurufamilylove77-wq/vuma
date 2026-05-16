import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function writeAuditLog(supabase: any, entity: string, entity_id: string, action: string, actor_id: string, metadata?: object) {
  await supabase.from("audit_logs").insert({ entity, entity_id, action, actor_id, metadata: metadata ?? null });
}

export const requestLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      chama_id: z.string().uuid(),
      principal: z.number().positive().max(100_000_000),
      interest_rate: z.number().min(0).max(100).default(0),
      due_date: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: loan, error } = await supabase.from("loans").insert({
      borrower_id: userId,
      chama_id: data.chama_id,
      principal: data.principal,
      interest_rate: data.interest_rate,
      balance: data.principal,
      due_date: data.due_date,
      status: "pending",
    }).select().single();
    if (error) throw new Error(error.message);
    await writeAuditLog(supabase, "loans", loan.id, "loan_requested", userId, { principal: data.principal, chama_id: data.chama_id });
    return loan;
  });

export const decideLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      loan_id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: loan, error } = await supabase
      .from("loans")
      .update({ status: data.decision, approved_by: userId })
      .eq("id", data.loan_id)
      .select().single();
    if (error) throw new Error(error.message);
    await writeAuditLog(supabase, "loans", data.loan_id, `loan_${data.decision}`, userId, { decision: data.decision });
    return loan;
  });

export const recordRepayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      loan_id: z.string().uuid(),
      amount: z.number().positive().max(100_000_000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("loan_repayments").insert({
      loan_id: data.loan_id, amount: data.amount, recorded_by: userId,
    }).select().single();
    if (error) throw new Error(error.message);
    await writeAuditLog(supabase, "loan_repayments", row.id, "repayment_recorded", userId, { loan_id: data.loan_id, amount: data.amount });
    return row;
  });
