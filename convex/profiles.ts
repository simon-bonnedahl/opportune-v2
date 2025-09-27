import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { getModel, getProvider } from "./matches";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const BUILD_CANDIDATE_PROFILE_PROMPT = `
You are a helpful assistant that builds a candidate profile from a candidate's assessment, hubert answers, resume summary and linkedin summary.
Some of the information may be missing or incomplete.
All text should be in Swedish.
Scoring is and should be in range 1-5
If the information is not available, return an empty array or string.
Dont make up information or make assumptions. 

The candidate profile should be a JSON object with the following fields:
- description: a short sentence that describes the candidate, dont use the canidates name in the description
- summary: a summary of the candidate's profile, dont use the canidates name in the summary
- education: an array of the candidate's education (include degree type, field of study, university, graduation year if available)
- technicalSkills: an array of the candidate's technical skills with a score between 1 and 5
- softSkills: an array of the candidate's soft skills.
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
  "softSkills": ["string"],
  "workExperience": ["string"],
  "aspirations": ["string"],
  "preferences": ["string"],
  "confidence": "number"
}

Return only the JSON object.
Do not include any other text or comments.
`;



export const buildCandidateProfile = internalAction({
  args: { hubertAnswers: v.optional(v.string()), resumeSummary: v.optional(v.string()), assessment: v.optional(v.any()), linkedinSummary: v.optional(v.string()), model: v.string() },
  handler: async (ctx, args) => {
    const { hubertAnswers, resumeSummary, assessment, linkedinSummary } = args;

    //TODO: Maybe change to generateObject
    const model = getModel(args.model) ?? openai('gpt-5');
    const provider = getProvider(args.model) ?? "OpenAI";
    const prompt = BUILD_CANDIDATE_PROFILE_PROMPT.replace("{{hubertAnswers}}", hubertAnswers ?? "None").replace("{{resumeSummary}}", resumeSummary ?? "None").replace("{{assessment}}", assessment?.comment ?? "None").replace("{{linkedinSummary}}", linkedinSummary ?? "None");

    const response = await generateObject({
        model,
        schema: z.object({
          summary: z.string(),
          description: z.string(),
          education: z.array(z.string()),
          technicalSkills: z.array(z.object({ name: z.string(), score: z.number() })),
          softSkills: z.array(z.string()),
          workExperience: z.array(z.string()),
          preferences: z.array(z.string()),
          aspirations: z.array(z.string()),
          confidence: z.number(),
        }),
        prompt,
      });
    return { metadata: { modelId: model.modelId, provider, totalUsage: response.usage, prompt, confidence: response.object.confidence }, profile: response.object };

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
- education: an array of required or preferred education/degree fields (be specific about degree types and fields of study)
- technicalSkills: an array of required or meriting technical skills with a score between 1 and 5 (5 = must-have, 1 = nice-to-have)
- softSkills: an array of required or meriting soft skills
- workTasks: an array of main work tasks and responsibilities
- aspirations: an array of opportunities or growth paths the job offers
- preferences: an array of preferences or requirements (e.g., location, start date, industry, work environment)
- confidence: a score between 1-10 indicating how strong the input data is for building a good profile (10 = excellent data quality, 1 = very poor data quality)

Teamtailor Body:
{{teamtailorBody}}

Body:
{{body}}


The job profile should be in the following format:
{
  "summary": "string",
  "education": ["string"],
  "technicalSkills": [{"name": "string", "score": "number"}],
  "softSkills": ["string"],
  "workTasks": ["string"],
  "aspirations": ["string"],
  "preferences": ["string"],
  "confidence": "number"
}

Return only the JSON object.
Do not include any other text or comments.


`;


export const buildJobProfile = internalAction({
  args: { teamTailorBody: v.optional(v.any()), body: v.optional(v.any()), model: v.string() },
  handler: async (ctx, args) => {
    const { teamTailorBody, body } = args;
    const prompt = BUILD_JOB_PROFILE_PROMPT.replace("{{teamtailorBody}}", JSON.stringify(teamTailorBody)).replace("{{body}}", JSON.stringify(body));
    const model = getModel(args.model) ?? openai('gpt-5');
    const provider = getProvider(args.model) ?? "OpenAI";
    const response = await generateObject({
      model,
      schema: z.object({
        summary: z.string(),
        education: z.array(z.string()),
        technicalSkills: z.array(z.object({ name: z.string(), score: z.number() })),
        softSkills: z.array(z.string()),
        workTasks: z.array(z.string()),
        aspirations: z.array(z.string()),
        preferences: z.array(z.string()),
        confidence: z.number(),
      }),
      prompt,
    });
    return { metadata: { modelId: model.modelId, provider, totalUsage: response.usage, prompt, confidence: response.object.confidence }, profile: response.object };
  }
});
