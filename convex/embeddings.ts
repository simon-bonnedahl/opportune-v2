import { v } from "convex/values";
import { internalAction } from "./_generated/server";

import { openai } from '@ai-sdk/openai';
import { embed as aiEmbed, embedMany as aiEmbedMany } from 'ai';




export const embed = internalAction({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const modelId = "text-embedding-3-small";
    const dimensions = 1536;
    const { embedding, usage, providerMetadata } = await aiEmbed({
      model: openai.textEmbeddingModel(modelId),
      value: text
    });
    return { embedding, usage, providerMetadata, modelId, dimensions };
  }
});

export const embedMany = internalAction({
  args: { texts: v.array(v.string()) },
  handler: async (ctx, { texts }) => {
    const modelId = "text-embedding-3-small";
    const dimensions = 1536;
    const { embeddings, usage, providerMetadata, } = await aiEmbedMany({
      model: openai.textEmbeddingModel(modelId),
      values: texts
    });
    return { embeddings, metadata: { usage, providerMetadata, modelId, dimensions } };
  }
});

