import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI-powered parser using Anthropic Claude API.
 * Accepts raw text (e.g. M-Pesa SMS bodies, pasted statements)
 * OR an image data URL. Returns structured contributions ready to import.
 * Set ANTHROPIC_API_KEY in your environment variables.
 */
export const parseContributions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      text: z.string().max(50_000).optional(),
      imageDataUrl: z.string().max(8_000_000).optional(),
    }).refine((d) => d.text || d.imageDataUrl, "text or image required").parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const systemPrompt = `You extract financial contributions from M-Pesa SMS messages, bank statements, or scanned receipts.
Return STRICT JSON only matching this schema — no preamble, no markdown fences:
{ "contributions": [ { "contributor_name": string, "amount": number, "reference": string|null, "contributed_at": string|null, "notes": string|null } ] }
Currency is KES. "amount" must be a positive number. Skip non-credit transactions. If unsure about a row, omit it.`;

    // Build content array for the user message
    const userContent: any[] = [];
    if (data.text) {
      userContent.push({ type: "text", text: data.text });
    }
    if (data.imageDataUrl) {
      // Parse data URL: "data:<mediaType>;base64,<data>"
      const match = data.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: match[2],
          },
        });
      }
    }
    userContent.push({ type: "text", text: "Extract all contributions from the above and return JSON only." });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
    if (res.status === 401) throw new Error("Invalid Anthropic API key. Check your ANTHROPIC_API_KEY environment variable.");
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Anthropic API error ${res.status}: ${(errBody as any)?.error?.message ?? "unknown"}`);
    }

    const body = await res.json();
    const raw = body?.content?.[0]?.text ?? "{}";

    let parsed: any = {};
    try {
      // Strip any accidental markdown fences
      const clean = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = {};
    }

    const rows = Array.isArray(parsed?.contributions) ? parsed.contributions : [];

    return {
      contributions: rows
        .filter((r: any) => typeof r?.amount === "number" && r.amount > 0)
        .map((r: any) => ({
          contributor_name: String(r.contributor_name ?? "Unknown").slice(0, 100),
          amount: Number(r.amount),
          reference: r.reference ? String(r.reference).slice(0, 100) : null,
          contributed_at: r.contributed_at ? String(r.contributed_at) : null,
          notes: r.notes ? String(r.notes).slice(0, 500) : null,
        })),
    };
  });
