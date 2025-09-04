"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const embedTexts = internalAction({
  args: {
    items: v.array(
      v.object({ id: v.string(), text: v.string(), model: v.optional(v.string()) })
    ),
    defaultModel: v.optional(v.string()),
  },
  returns: v.array(
    v.object({ id: v.string(), embedding: v.array(v.number()), model: v.string() })
  ),
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    const byModel: Record<string, Array<{ id: string; text: string }>> = {};
    for (const it of args.items) {
      const model = (it.model ?? args.defaultModel ?? "text-embedding-3-small").trim();
      if (!byModel[model]) byModel[model] = [];
      byModel[model].push({ id: it.id, text: it.text });
    }

    const results: Array<{ id: string; embedding: Array<number>; model: string }> = [];
    for (const [model, group] of Object.entries(byModel)) {
      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, input: group.map((g) => g.text) }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`Embeddings request failed: ${resp.status} ${txt}`);
      }
      const data: any = await resp.json();
      const vectors: Array<Array<number>> = (data?.data ?? []).map((d: any) => d?.embedding ?? []);
      for (let i = 0; i < group.length; i++) {
        results.push({ id: group[i].id, embedding: vectors[i] ?? [], model });
      }
    }
    return results;
  },
});




