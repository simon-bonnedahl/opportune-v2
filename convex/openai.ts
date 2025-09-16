import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

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
- description: a short sentence that describes the candidate
- summary: a summary of the candidate's profile
- education: an array of the candidate's education
- technicalSkills: an array of the candidate's technical skills with a score between 1 and 5
- softSkills: an array of the candidate's soft skills with a score between 1 and 5
- workExperience: an array of the candidate's work experience
- aspirations: an array of the candidate's aspirations
- preferences: an array of the candidate's preferences
- confidence: a score between 1-10 indicating how strong the input data is for building a good profile (10 = excellent data quality, 1 = very poor data quality)

Assessment:
{{assessment}}

Hubert Answers:
{{hubertAnswers}}

Resume Summary:
{{resumeSummary}}

Linkedin Summary:
{{linkedinSummary}}

The candidate profile should be in the following format:
{
  "description": "string",
  "summary": "string",
  "education": ["string"],
  "technicalSkills": [{"name": "string", "score": "number"}],
  "softSkills": [{"name": "string", "score": "number"}],
  "workExperience": ["string"],
  "aspirations": ["string"],
  "preferences": ["string"],
  "confidence": "number"
}

Return only the JSON object.
Do not include any other text or comments.
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
  confidence: number;
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
    return{ metadata: { modelId: model.modelId, totalUsage, prompt, confidence: profile.confidence }, raw: text, profile: profile};
  }
});

const BUILD_JOB_PROFILE_PROMPT = `
You are a helpful assistant that builds a job profile from a teamtailor body.
Some of the information may be missing or incomplete.
All text should be in Swedish.
Scoring is and should be in range 1-5 where applicable (for skills).
If the information is not available, return an empty array or string.
Do not make up information or make assumptions.

The job profile should be a JSON object with the following fields:
- summary: a summary of the job and its main responsibilities
- education: an array of required or preferred education/degree fields
- technicalSkills: an array of required or meriting technical skills with a score between 1 and 5 (5 = must-have, 1 = nice-to-have)
- softSkills: an array of required or meriting soft skills with a score between 1 and 5 (5 = must-have, 1 = nice-to-have)
- workTasks: an array of main work tasks and responsibilities
- aspirations: an array of opportunities or growth paths the job offers
- preferences: an array of preferences or requirements (e.g., location, start date, industry, work environment)
- confidence: a score between 1-10 indicating how strong the input data is for building a good profile (10 = excellent data quality, 1 = very poor data quality)

Teamtailor Body:
{{teamtailorBody}}


The job profile should be in the following format:
{
  "summary": "string",
  "education": ["string"],
  "technicalSkills": [{"name": "string", "score": "number"}],
  "softSkills": [{"name": "string", "score": "number"}],
  "workTasks": ["string"],
  "aspirations": ["string"],
  "preferences": ["string"],
  "confidence": "number"
}

Return only the JSON object.
Do not include any other text or comments.


`;

type JobProfile = {
  summary: string;
  education: string[];
  technicalSkills: { name: string; score: number }[];
  softSkills: { name: string; score: number }[];
  workTasks: string[];
  aspirations: string[];
  preferences: string[];
  confidence: number;
};

export const buildJobProfile = internalAction({
  args: { teamTailorBody: v.any() },
  handler: async (ctx, { teamTailorBody }) => {
    const prompt = BUILD_JOB_PROFILE_PROMPT.replace("{{teamtailorBody}}", JSON.stringify(teamTailorBody));
    const model : LanguageModel = openai('gpt-5')
    const { text, totalUsage } = await generateText({
      model,
      prompt
    });
    const profile: JobProfile = JSON.parse(text);
    return { metadata: { modelId: model.modelId, totalUsage, prompt, confidence: profile.confidence }, raw: text, profile: profile};
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


const MATCH_PROMPT = `
You are an expert candidate–job matching engine.
Given a structured Candidate Profile and Job Profile, compute a suitability score between 0.0 and 1.0.
All text should be in Swedish.
You will be given a set of scoring guidelines to follow below.

Scoring Guidelines:

{{scoringGuidelines}}

Candidate Profile:

{{candidateProfile}}

Job Profile:

{{jobProfile}}


The match should be a JSON object with the following fields:
- score: a score between 0.0 and 1.0
- explanation: a concise explanation of the match
- confidence: a score between 1-10 indicating how strong the input data is for building a good match (10 = excellent data quality, 1 = very poor data quality)

The response should be in the following format:
{
  "score": "number",
  "explanation": "string",
  "confidence": "number"
}

Return only the JSON object.
Do not include any other text or comments.
`;

type MatchResponse = {
  score: number;
  explanation: string;
  confidence: number;
};

export const match = internalAction({
  args: { candidateProfile: v.any(), jobProfile: v.any(), scoringGuidelines: v.string() },
  handler: async (ctx, { candidateProfile, jobProfile, scoringGuidelines }) => {
    const model : LanguageModel = openai('gpt-5')
    const prompt = MATCH_PROMPT.replace("{{scoringGuidelines}}", scoringGuidelines).replace("{{candidateProfile}}", JSON.stringify(candidateProfile)).replace("{{jobProfile}}", JSON.stringify(jobProfile));
    const { text, totalUsage } = await generateText({
      model,
      prompt
    });
    const response: MatchResponse = JSON.parse(text);
    return { metadata: { modelId: model.modelId, totalUsage, prompt, confidence: response.confidence }, raw: text, response: response };
  }
});
