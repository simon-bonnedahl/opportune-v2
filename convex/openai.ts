import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

import { openai } from '@ai-sdk/openai';
import { generateText, embed as aiEmbed, embedMany as aiEmbedMany, LanguageModel } from 'ai';



const BUILD_CANDIDATE_PROFILE_PROMPT = `
You are a helpful assistant that builds a candidate profile from a candidate's assessment, hubert answers, resume summary and linkedin summary.
Some of the information may be missing or incomplete.
All text should be in Swedish.
Scoring is and should be in range 1-5
If the information is not available, return an empty array or string.
Dont make up information or make assumptions. 

The candidate profile should be a JSON object with the following fields:
- description: 1 short sentence that describes the candidate
- summary: a summary of the candidate's profile
- education: an array of the candidate's education
- technicalSkills: an array of the candidate's technical skills with a score between 1 and 5
- softSkills: an array of the candidate's soft skills with a score between 1 and 5
- workExperience: an array of the candidate's work experience
- aspirations: an array of the candidate's aspirations
- preferences: an array of the candidate's preferences

The candidate profile should be in the following format:
{
  "summary": "string",
  "description": "string",
  "education": ["string"],
  "technicalSkills": [{"name": "string", "score": "number"}],
  "softSkills": [{"name": "string", "score": "number"}],
  "workExperience": ["string"],
  "aspirations": ["string"]
  "preferences": ["string"],
}

Return only the JSON object.
Do not include any other text or comments.

Assessment:
{{assessment}}

Hubert Answers:
{{hubertAnswers}}

Resume Summary:
{{resumeSummary}}

Linkedin Summary:
{{linkedinSummary}}
`;

type CandidateProfile = {
  summary: string;
  description: string;
  education: string[];
  technicalSkills: { name: string; score: number }[];
  softSkills: { name: string; score: number }[];
  workExperience: string[];
  preferences: string[];
  aspirations: string[];
};


export const buildCandidateProfile = internalAction({
  args: { hubertAnswers: v.optional(v.string()), resumeSummary: v.optional(v.string()), assessment: v.optional(v.any()), linkedinSummary: v.optional(v.string()) },
  handler: async (ctx, { hubertAnswers, resumeSummary, assessment, linkedinSummary }) => {

    const prompt = BUILD_CANDIDATE_PROFILE_PROMPT.replace("{{hubertAnswers}}", hubertAnswers ?? "None").replace("{{resumeSummary}}", resumeSummary ?? "None").replace("{{assessment}}", assessment.comment ?? "None").replace("{{linkedinSummary}}", linkedinSummary ?? "None");
    //TODO: Maybe change to generateObject
    const model : LanguageModel = openai('gpt-5')
    const { text, totalUsage } = await generateText({
      model,
      prompt
    });
    const profile: CandidateProfile = JSON.parse(text);
    return{ metadata: { modelId: model.modelId, totalUsage, prompt, }, raw: text, profile: profile};
  }
});

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

