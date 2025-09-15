// "use node";

// import { internalAction } from "./_generated/server";
// import { v } from "convex/values";
// import { internal, api } from "./_generated/api";

// type OpenAIFile = { id: string };

// // Toggleable simulation of slow tasks
// const SIMULATE_SLOW = false; // set to true to enable
// const SIMULATE_SLOW_MIN_MS = 60_000; // 1 minute
// const SIMULATE_SLOW_MAX_MS = 300_000; // 5 minutes
// function randomDelayMs(): number {
//   const min = SIMULATE_SLOW_MIN_MS;
//   const max = SIMULATE_SLOW_MAX_MS;
//   return Math.floor(Math.random() * (max - min + 1)) + min;
// }
// function sleep(ms: number): Promise<void> {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// export const buildProfile = internalAction({
//   args: {
//     taskId: v.optional(v.string()),
//     candidateId: v.optional(v.id("candidates")),
//     resumeUrl: v.optional(v.string()),
//     assessment: v.optional(v.any()),
//     hubertAnswers: v.optional(v.any()),
//     model: v.optional(v.string()),
//     prompt: v.optional(v.string()),
//     config: v.optional(v.any()),
//   },
//   returns: v.object({ profile: v.string() }),
//   handler: async (ctx, { candidateId, resumeUrl, assessment, hubertAnswers, model, prompt, config, taskId }) => {
//     if (taskId) await ctx.runMutation(internal.tasks.markStarted, { taskId });
//     const apiKey = process.env.OPENAI_API_KEY;
//     if (!apiKey) throw new Error("OPENAI_API_KEY not set");
//     if (SIMULATE_SLOW) await sleep(randomDelayMs());

//     // If caller didn't pass source data, load from candidateSourceData
//     let cvSummary: any | undefined = undefined;
//     if (candidateId && (!resumeUrl || !assessment || !hubertAnswers)) {
//       try {
//         const rows: any[] = await ctx.runQuery((api as any).candidates.getSourceDataByCandidateIds, { candidateIds: [candidateId] });
//         const src: any = rows?.[0] ?? {};
//         // Do not read sourceUrl from cv; sourceUrl removed by design
//         if (!assessment && typeof src?.assessment !== "undefined") assessment = src.assessment;
//         if (!hubertAnswers && typeof src?.hubertAnswers !== "undefined") hubertAnswers = src.hubertAnswers;
//         if (typeof src?.cv?.summary !== "undefined") cvSummary = src.cv.summary;
//       } catch (_e) {
//         // best-effort
//       }
//     }

//     let fileId: string | undefined;
//     if (resumeUrl) {
//       if (taskId && await ctx.runQuery(internal.tasks.shouldCancel, { taskId })) {
//         return { profile: "" };
//       }
//       const res = await fetch(resumeUrl);
//       if (!res.ok) throw new Error(`CV fetch failed: ${res.status}`);
//       const bytes = new Uint8Array(await res.arrayBuffer());
//       const form = new FormData();
//       const blob = new Blob([bytes], { type: "application/pdf" });
//       form.append("file", blob, "resume.pdf");
//       form.append("purpose", "assistants");
//       const upload = await fetch("https://api.openai.com/v1/files", {
//         method: "POST",
//         headers: { Authorization: `Bearer ${apiKey}` },
//         body: form,
//       });
//       if (!upload.ok) throw new Error(`OpenAI file upload failed: ${upload.status}`);
//       const uploaded: OpenAIFile = await upload.json();
//       fileId = uploaded.id;
//       if (taskId) await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 10, message: "Uploaded resume" });
//     }

//     const chosenModel = model ?? "gpt-5";
//     const instructions = (prompt && prompt.trim().length > 0) ? prompt : `You are an expert profile builder.

// Return STRICT JSON matching this schema (no extra fields, no prose):
// {
//   "summary": string,
//   "education": [
//     { "institution": string?, "degree": string?, "field": string?, "startDate": string?, "endDate": string?, "notes": string? }
//   ],
//   "skills": [
//     { "name": string, "score": number }
//   ],
//   "workExperience": [
//     { "company": string?, "title": string?, "startDate": string?, "endDate": string?, "responsibilities": string[]? }
//   ]
// }

// Scoring for skills: 0–10 (10 = expert). Dates as free-form strings if unknown. If information is missing, use empty arrays or omit optional fields.`;

//     const input: any = [
//       {
//         role: "user",
//         content: [
//           { type: "input_text", text: instructions },
//           { type: "input_text", text: `Assessments: ${JSON.stringify(assessment ?? null)}` },
//           { type: "input_text", text: `Hubert Answers: ${JSON.stringify(hubertAnswers ?? null)}` },
//           { type: "input_text", text: `CV Summary: ${JSON.stringify(cvSummary ?? null)}` },
//           ...(fileId ? [{ type: "input_file", file_id: fileId }] : []),
//         ],
//       },
//     ];

//     // Use json_object format to avoid strict schema incompatibilities seen in logs
//     const jsonSchema = null as any;

//     const makeReq = async (mdl: string, fmt: any) =>
//       await fetch("https://api.openai.com/v1/responses", {
//         method: "POST",
//         headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ model: mdl, input, ...(fmt ? { text: { format: fmt } } : {}) }),
//       });

//     if (taskId && await ctx.runQuery(internal.tasks.shouldCancel, { taskId })) {
//       return { profile: "" };
//     }
//     // Directly request json_object to avoid schema issues
//     let resp = await makeReq(chosenModel, { type: "json_object" });
//     if (!resp.ok) {
//       resp = await makeReq("gpt-4o-mini", { type: "json_object" });
//     }
//     if (!resp.ok) throw new Error(`OpenAI response failed: ${resp.status}`);
//     const data = await resp.json();
//     if (taskId) await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 60, message: "Model responded" });
//     let raw: string | null = null;
//     // Prefer Responses API shape: output[].content[].text
//     if (Array.isArray(data?.output)) {
//       for (const part of data.output) {
//         if (part?.type === "message" && Array.isArray(part?.content)) {
//           const textPiece = part.content.find((c: any) => c?.type === "output_text" && typeof c?.text === "string");
//           if (textPiece) { raw = textPiece.text as string; break; }
//         }
//       }
//     }
//     // Fallbacks for other shapes
//     if (!raw && typeof data?.output_text === "string") raw = data.output_text;
//     if (!raw && typeof data?.choices?.[0]?.message?.content === "string") raw = data.choices[0].message.content;
//     if (!raw) raw = JSON.stringify(data);
//     const fence = /```(?:json)?\s*([\s\S]*?)```/m; const m = raw.match(fence); if (m && m[1]) raw = m[1];
//     let structured: any; try { structured = JSON.parse(raw); } catch { structured = { summary: raw, education: [], skills: [], workExperience: [] }; }
//     structured.education = Array.isArray(structured.education) ? structured.education : [];
//     structured.skills = Array.isArray(structured.skills) ? structured.skills : [];
//     structured.workExperience = Array.isArray(structured.workExperience) ? structured.workExperience : [];
//     if (taskId) await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 90, message: "Parsed profile" });
//     if (candidateId) {
//       const updatedAt = Date.now();
//       await ctx.runMutation((internal as any).candidates.upsertCandidateProfile, {
//         candidateId,
//         summary: structured.summary,
//         raw,
//         metadata: { model: chosenModel, prompt: instructions, config: config ?? null },
//         education: structured.education,
//         skills: structured.skills,
//         workExperience: structured.workExperience,
//         updatedAt,
//       });
//       try { await ctx.runMutation((internal as any).candidates.setCandidateProcessingStatus, { candidateId: candidateId!, processingStatus: "profile_built" }); } catch {}

//       // Build chunks + embeddings in Node, then persist via mutation
//       try {
//         const profileText = JSON.stringify(structured);
//         const model = "text-embedding-3-large";
//         const dims = 3072;
//         const now = Date.now();

//         const summary = (structured?.summary ?? "").toString();
//         const skills = Array.isArray(structured?.skills)
//           ? structured.skills.map((s: any) => s?.name).filter(Boolean).join(", ")
//           : "";
//         const workBullets: Array<string> = [];
//         if (Array.isArray(structured?.workExperience)) {
//           for (const w of structured.workExperience) {
//             if (Array.isArray(w?.responsibilities)) for (const r of w.responsibilities) workBullets.push(String(r ?? ""));
//           }
//         }
//         const experience = workBullets.join("\n");

//         const items = [
//           { id: "summary", text: summary, model },
//           { id: "skills", text: skills, model },
//           { id: "experience", text: experience, model },
//         ].filter((i) => i.text && i.text.length > 0);

//         const embeds = await ctx.runAction(internal.embeddingsAction.embedTexts, {
//           items,
//           defaultModel: model,
//         });

//         await ctx.runMutation(api.embeddings.saveCandidateEmbeddings, {
//           candidateId,
//           rows: embeds.map((e: any) => ({
//             kind: e.id,
//             text: items.find((it) => it.id === e.id)!.text,
//             embedding: e.embedding,
//             embeddingModel: model,
//             embeddingDims: dims,
//             embeddingVersion: 1,
//           })),
//           updatedAt: now,
//         });
//       } catch {}
//     }
//     if (taskId) await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 100, message: "Done" });
//     return { profile: JSON.stringify(structured) };
//   },
// });


// export const buildJobProfile = internalAction({
//   args: {
//     jobId: v.id("jobs"),
//     taskId: v.optional(v.string()),
//     body: v.optional(v.string()),
//     metadata: v.optional(v.any()),
//     model: v.optional(v.string()),
//     prompt: v.optional(v.string()),
//     config: v.optional(v.any()),
//   },
//   returns: v.object({ profile: v.string() }),
//   handler: async (ctx, { jobId, body, metadata, model, prompt, config, taskId }) => {
//     if (taskId) try { await ctx.runMutation(internal.tasks.markStarted, { taskId }); } catch {}
//     const apiKey = process.env.OPENAI_API_KEY;
//     if (!apiKey) throw new Error("OPENAI_API_KEY not set");
//     if (SIMULATE_SLOW) await sleep(randomDelayMs());

//     // If caller didn't pass body/metadata, load from jobSourceData
//     if ((!body || String(body).trim().length === 0) || metadata == null) {
//       try {
//         const rows: any[] = await ctx.runQuery((api as any).teamtailor.getJobSourceDataByJobIds, { jobIds: [jobId] });
//         const src: any = rows?.[0] ?? {};
//         if (!body && typeof src?.body === "string") body = src.body;
//         if (metadata == null) {
//           const md: any = {};
//           if (src?.links) md.links = src.links;
//           if (src?.tags) md.tags = src.tags;
//           if (src?.recruiterEmail) md.recruiterEmail = src.recruiterEmail;
//           if (src?.remoteStatus) md.remoteStatus = src.remoteStatus;
//           if (src?.languageCode) md.languageCode = src.languageCode;
//           if (src?.mailbox) md.mailbox = src.mailbox;
//           if (src?.humanStatus) md.humanStatus = src.humanStatus;
//           if (typeof src?.internal !== "undefined") md.internal = src.internal;
//           metadata = md;
//         }
//       } catch (_e) {
//         // best-effort
//       }
//     }

//     const chosenModel = model ?? "gpt-5";
//     const instructions = (prompt && prompt.trim().length > 0) ? prompt : `You are an expert job-profile summarizer.

// Return STRICT JSON matching this schema (no extra fields, no prose):
// {
//   "summary": string,
//   "responsibilities": string[],
//   "requirements": string[],
//   "skills": [ { "name": string, "score": number } ]
// }

// Interpret the job description body. Extract concise responsibilities and requirements as bullet sentences. Infer skills with 0–10 scores.`;

//     const input: any = [
//       {
//         role: "user",
//         content: [
//           { type: "input_text", text: instructions },
//           { type: "input_text", text: `Job body: ${body ?? ""}` },
//           { type: "input_text", text: `Metadata: ${JSON.stringify(metadata ?? null)}` },
//         ],
//       },
//     ];

//     // Avoid strict JSON schema due to provider validation diffs; request json_object directly
//     const jsonSchema = null as any;

//     const makeReq = async (mdl: string, fmt: any) =>
//       await fetch("https://api.openai.com/v1/responses", {
//         method: "POST",
//         headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ model: mdl, input, ...(fmt ? { text: { format: fmt } } : {}) }),
//       });

//     let resp = await makeReq(chosenModel, { type: "json_object" });
//     if (!resp.ok) resp = await makeReq("gpt-4o-mini", { type: "json_object" });
//     if (!resp.ok) throw new Error(`OpenAI response failed: ${resp.status}`);
//     const data = await resp.json();
//     let raw: string | null = null;
//     if (Array.isArray(data?.output)) {
//       for (const part of data.output) {
//         if (part?.type === "message" && Array.isArray(part?.content)) {
//           const textPiece = part.content.find((c: any) => c?.type === "output_text" && typeof c?.text === "string");
//           if (textPiece) { raw = textPiece.text as string; break; }
//         }
//       }
//     }
//     if (!raw && typeof data?.output_text === "string") raw = data.output_text;
//     if (!raw && typeof data?.choices?.[0]?.message?.content === "string") raw = data.choices[0].message.content;
//     if (!raw) raw = JSON.stringify(data);
//     const fence = /```(?:json)?\s*([\s\S]*?)```/m; const m = raw.match(fence); if (m && m[1]) raw = m[1];
//     let structured: any; try { structured = JSON.parse(raw); } catch { structured = { summary: raw, responsibilities: [], requirements: [], skills: [] }; }
//     structured.responsibilities = Array.isArray(structured.responsibilities) ? structured.responsibilities : [];
//     structured.requirements = Array.isArray(structured.requirements) ? structured.requirements : [];
//     structured.skills = Array.isArray(structured.skills) ? structured.skills : [];

//     const updatedAt = Date.now();
//     await ctx.runMutation((internal as any).jobs.upsertJobProfile, {
//       jobId,
//       summary: structured.summary,
//       responsibilities: structured.responsibilities,
//       requirements: structured.requirements,
//       skills: structured.skills,
//       raw,
//       metadata: { model: chosenModel, prompt: instructions, config: config ?? null, inputMetadata: metadata ?? null },
//       updatedAt,
//     });
//     try { await ctx.runMutation((internal as any).jobs.setJobProcessingStatus, { jobId, processingStatus: "profile_built" }); } catch {}

//     try {
//       const model = "text-embedding-3-small";
//       const dims = 1536;
//       const now = Date.now();
//       try { await ctx.runMutation((internal as any).jobs.setJobProcessingStatus, { jobId, processingStatus: "embeddings_building" }); } catch {}
//       const items = [
//         { id: "summary", text: String(structured?.summary ?? ""), model },
//         { id: "responsibilities", text: Array.isArray(structured?.responsibilities) ? structured.responsibilities.join("\n") : "", model },
//         { id: "requirements", text: Array.isArray(structured?.requirements) ? structured.requirements.join("\n") : "", model },
//         { id: "skills", text: Array.isArray(structured?.skills) ? structured.skills.map((s: any) => s?.name).filter(Boolean).join(", ") : "", model },
//       ].filter((i) => i.text && i.text.length > 0);

//       const embeds = await ctx.runAction(internal.embeddingsAction.embedTexts, {
//         items,
//         defaultModel: model,
//       });

//       await ctx.runMutation(api.embeddings.saveJobEmbeddings, {
//         jobId,
//         rows: embeds.map((e: any) => ({
//           kind: e.id,
//           text: items.find((it) => it.id === e.id)!.text,
//           embedding: e.embedding,
//           embeddingModel: model,
//           embeddingDims: dims,
//           embeddingVersion: 1,
//         })),
//         updatedAt: now,
//       });
//       try { await ctx.runMutation((internal as any).jobs.setJobProcessingStatus, { jobId, processingStatus: "embeddings_built" }); } catch {}
//     } catch {}

//     return { profile: JSON.stringify(structured) };
//   },
// });

// export const buildCandidateEmbeddingsWrapper = internalAction({
//   args: {
//     candidateId: v.id("candidates"),
//     taskId: v.optional(v.string()),
//     embeddingModel: v.optional(v.string()),
//     embeddingVersion: v.optional(v.number()),
//   },
//   returns: v.null(),
//   handler: async (ctx, { candidateId, embeddingModel, embeddingVersion, taskId }) => {
//     if (taskId) try { await ctx.runMutation(internal.tasks.markStarted, { taskId }); } catch {}
//     const model = (embeddingModel ?? "text-embedding-3-small").trim();
//     const dims = model.includes("-large") ? 3072 : 1536;
//     const now = Date.now();
//     if (SIMULATE_SLOW) await sleep(randomDelayMs());

//     // Load profile and source via queries
//     const profiles: any[] = await ctx.runQuery((api as any).candidates.getProfilesByCandidateIds, {
//       candidateIds: [candidateId],
//     });
//     const sources: any[] = await ctx.runQuery((api as any).candidates.getSourceDataByCandidateIds, {
//       candidateIds: [candidateId],
//     });
//     const prof = profiles?.[0] ?? {};
//     const src = sources?.[0] ?? {};

//     const summary = String(prof?.summary ?? prof?.raw ?? "");
//     const skills = Array.isArray(prof?.skills)
//       ? prof.skills.map((s: any) => s?.name).filter(Boolean).join(", ")
//       : "";
//     const workBullets: string[] = [];
//     if (Array.isArray(prof?.workExperience)) {
//       for (const w of prof.workExperience) {
//         if (Array.isArray(w?.responsibilities)) for (const r of w.responsibilities) workBullets.push(String(r ?? ""));
//       }
//     }
//     const experience = workBullets.join("\n");
//     const eduLines: string[] = [];
//     if (Array.isArray(prof?.education)) {
//       for (const e of prof.education) {
//         const line = [e?.degree, e?.field, e?.institution].filter(Boolean).join(", ");
//         const dates = [e?.startDate, e?.endDate].filter(Boolean).join(" – ");
//         eduLines.push([line, dates].filter(Boolean).join(" (") + (dates ? ")" : ""));
//       }
//     }
//     const educationText = eduLines.join("\n");
//     const rawFull = String(prof?.raw ?? "");
//     const items = [
//       { id: "summary", text: summary, model },
//       { id: "skills", text: skills, model },
//       { id: "experience", text: experience, model },
//       { id: "education", text: educationText, model },
//       { id: "raw", text: rawFull, model },
//     ].filter((i) => i.text && i.text.length > 0);

//     const embeds = await ctx.runAction(internal.embeddingsAction.embedTexts, {
//       items,
//       defaultModel: model,
//     });

//     await ctx.runMutation(api.embeddings.saveCandidateEmbeddings, {
//       candidateId,
//       rows: embeds.map((e: any) => ({
//         kind: e.id,
//         text: items.find((it) => it.id === e.id)!.text,
//         embedding: e.embedding,
//         embeddingModel: model,
//         embeddingDims: dims,
//         embeddingVersion: embeddingVersion ?? 1,
//       })),
//       updatedAt: now,
//     });
//     return null;
//   },
// });

// export const buildJobEmbeddingsWrapper = internalAction({
//   args: {
//     jobId: v.id("jobs"),
//     taskId: v.optional(v.string()),
//     embeddingModel: v.optional(v.string()),
//     embeddingVersion: v.optional(v.number()),
//   },
//   returns: v.null(),
//   handler: async (ctx, { jobId, embeddingModel, embeddingVersion, taskId }) => {
//     if (taskId) try { await ctx.runMutation(internal.tasks.markStarted, { taskId }); } catch {}
//     const model = (embeddingModel ?? "text-embedding-3-small").trim();
//     const dims = model.includes("-large") ? 3072 : 1536;
//     const now = Date.now();
//     if (SIMULATE_SLOW) await sleep(randomDelayMs());

//     const jobs: any[] = await ctx.runQuery((api as any).jobs.getJobProfilesByJobIds, {
//       jobIds: [jobId],
//     });
//     const prof = jobs?.[0] ?? {};
//     const rawFull = String(prof?.raw ?? "");
//     const items = [
//       { id: "summary", text: String(prof?.summary ?? ""), model },
//       { id: "responsibilities", text: Array.isArray(prof?.responsibilities) ? prof.responsibilities.join("\n") : "", model },
//       { id: "requirements", text: Array.isArray(prof?.requirements) ? prof.requirements.join("\n") : "", model },
//       { id: "skills", text: Array.isArray(prof?.skills) ? prof.skills.map((s: any) => s?.name).filter(Boolean).join(", ") : "", model },
//       { id: "raw", text: rawFull, model },
//     ].filter((i) => i.text && i.text.length > 0);

//     const embeds = await ctx.runAction(internal.embeddingsAction.embedTexts, {
//       items,
//       defaultModel: model,
//     });

//     await ctx.runMutation(api.embeddings.saveJobEmbeddings, {
//       jobId,
//       rows: embeds.map((e: any) => ({
//         kind: e.id,
//         text: items.find((it) => it.id === e.id)!.text,
//         embedding: e.embedding,
//         embeddingModel: model,
//         embeddingDims: dims,
//         embeddingVersion: embeddingVersion ?? 1,
//       })),
//       updatedAt: now,
//     });
//     try { await ctx.runMutation(internal.teamtailor.setJobProcessingStatus, { jobId, processingStatus: "embeddings_built" }); } catch {}
//     return null;
//   },
// });

// export const matchCandidateToJob = internalAction({
//   args: {
//     candidateId: v.id("candidates"),
//     jobId: v.id("jobs"),
//     taskId: v.optional(v.string()),
//     model: v.optional(v.string()),
//     prompt: v.optional(v.string()),
//     config: v.optional(v.any()),
//   },
//   returns: v.object({ score: v.number(), explanation: v.string() }),
//   handler: async (ctx, { candidateId, jobId, taskId, model, prompt, config }) => {
//     if (taskId) try { await ctx.runMutation(internal.tasks.markStarted, { taskId }); } catch {}
//     if (SIMULATE_SLOW) await sleep(randomDelayMs());

//     try {
//       if (taskId) try { await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 5, message: "Loading profiles" }); } catch {}
//       const [cand] = (await ctx.runQuery((api as any).candidates.getProfilesByCandidateIds, { candidateIds: [candidateId] })) as any[];
//       const [job] = (await ctx.runQuery((api as any).jobs.getJobProfilesByJobIds, { jobIds: [jobId] })) as any[];
//       const candText = JSON.stringify(cand ?? {});
//       const jobText = JSON.stringify(job ?? {});
//       const instructions = (prompt && prompt.trim().length > 0) ? prompt : `You are an expert candidate–job matching engine.
// Given a structured Candidate Profile and Job Profile, compute a suitability score between 0.0 and 1.0.

// Return STRICT JSON only with fields:
// {"score": number, "explanation": string}

// Scoring guidelines:
// - Prioritize hard/mandatory requirements. If a must‑have is missing, cap score at 0.4.
// - Evaluate: skills overlap (names and synonyms), responsibilities alignment, seniority/level, industry/domain, tools/technologies, education/certifications, recency and depth of experience.
// - Penalize outdated or non‑relevant experience and level mismatches.
// - Use the full 0.0–1.0 range; reserve ≥0.8 for strong fits.
// - Keep explanation concise (≤80 words), cite 2–4 strongest signals and any critical gap.

// Return only the JSON object.`;
//       if (taskId) try { await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 20, message: "Calling model" }); } catch {}

//       const input: any = [
//         { role: "user", content: [
//           { type: "input_text", text: instructions },
//           { type: "input_text", text: `Candidate Profile: ${candText}` },
//           { type: "input_text", text: `Job Profile: ${jobText}` },
//         ]},
//       ];
//       const mdl = model ?? "gpt-5";
//       const lower = String(mdl).toLowerCase();

//       function openaiSupportsTemperature(m: string): boolean {
//         const l = m.toLowerCase();
//         if (l.includes("gpt-5")) return false;
//         if (l.startsWith("o3") || l.startsWith("o4")) return false;
//         return true;
//       }

//       function openaiSupportsReasoning(m: string): boolean {
//         const l = m.toLowerCase();
//         return l.startsWith("o3") || l.startsWith("o4") || l.includes("gpt-5");
//       }
//       let raw: string | null = null;
//       if (lower.includes("claude")) {
//         const anthKey = process.env.ANTHROPIC_API_KEY;
//         if (!anthKey) throw new Error("ANTHROPIC_API_KEY not set");
//         const res = await fetch("https://api.anthropic.com/v1/messages", {
//           method: "POST",
//           headers: {
//             "x-api-key": anthKey,
//             "anthropic-version": "2023-06-01",
//             "content-type": "application/json",
//           },
//           body: JSON.stringify({
//             model: mdl,
//             max_tokens: config?.maxTokens ?? 1024,
//             temperature: config?.temperature ?? 0,
//             system: "You are a matching engine. Return only a strict JSON object.",
//             messages: [
//               { role: "user", content: `${instructions}\n\nCandidate Profile: ${candText}\n\nJob Profile: ${jobText}` },
//             ],
//           }),
//         });
//         if (!res.ok) {
//           const body = await res.text();
//           throw new Error(`Anthropic response failed: ${res.status} ${body?.slice(0, 500)}`);
//         }
//         const data = await res.json();
//         const text = Array.isArray(data?.content) && data.content[0]?.type === "text" ? data.content[0]?.text : undefined;
//         raw = typeof text === "string" ? text : JSON.stringify(data);
//       } else if (lower.includes("gemini") || lower.startsWith("models/")) {
//         const gemKey = process.env.GOOGLE_API_KEY;
//         if (!gemKey) throw new Error("GOOGLE_API_KEY not set");
//         const modelPath = mdl.startsWith("models/") ? mdl : `models/${mdl}`;
//         const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${gemKey}`;
//         const res = await fetch(url, {
//           method: "POST",
//           headers: { "content-type": "application/json" },
//           body: JSON.stringify({
//             contents: [
//               {
//                 role: "user",
//                 parts: [
//                   { text: instructions },
//                   { text: `Candidate Profile: ${candText}` },
//                   { text: `Job Profile: ${jobText}` },
//                 ],
//               },
//             ],
//             generationConfig: {
//               response_mime_type: "application/json",
//               temperature: config?.temperature ?? 0,
//               topP: undefined,
//               topK: undefined,
//               maxOutputTokens: undefined,
//             },
//           }),
//         });
//         if (!res.ok) {
//           const body = await res.text();
//           throw new Error(`Gemini response failed: ${res.status} ${body?.slice(0, 500)}`);
//         }
//         const data = await res.json();
//         const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
//         raw = typeof text === "string" ? text : JSON.stringify(data);
//       } else if (lower.startsWith("groq/")) {
//         const groqKey = process.env.GROQ_API_KEY;
//         if (!groqKey) throw new Error("GROQ_API_KEY not set");
//         const groqModel = mdl.slice("groq/".length);
//         const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
//           method: "POST",
//           headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
//           body: JSON.stringify({
//             model: groqModel,
//             response_format: { type: "json_object" },
//             temperature: config?.temperature ?? 0,
//             messages: [
//               { role: "system", content: "You are a matching engine. Return only a strict JSON object with fields score and explanation." },
//               { role: "user", content: `${instructions}\n\nCandidate Profile: ${candText}\n\nJob Profile: ${jobText}` },
//             ],
//             max_tokens: 800,
//           }),
//         });
//         if (!res.ok) {
//           const body = await res.text();
//           throw new Error(`Groq response failed: ${res.status} ${body?.slice(0, 500)}`);
//         }
//         const data = await res.json();
//         const content = data?.choices?.[0]?.message?.content;
//         raw = typeof content === "string" ? content : JSON.stringify(data);
//       } else {
//         const apiKey = process.env.OPENAI_API_KEY;
//         if (!apiKey) throw new Error("OPENAI_API_KEY not set");
//         // Default OpenAI path
//         const res = await fetch("https://api.openai.com/v1/responses", {
//           method: "POST",
//           headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
//           body: JSON.stringify((() => {
//             const body: any = { model: mdl, input, text: { format: { type: "json_object" } } };
//             if (openaiSupportsTemperature(mdl)) body.temperature = config?.temperature ?? 0;
//             if (openaiSupportsReasoning(mdl) && config?.reasoningEffort) body.reasoning = { effort: config.reasoningEffort };
//             return body;
//           })()),
//         });
//         if (!res.ok) {
//           const body = await res.text();
//           throw new Error(`OpenAI response failed: ${res.status} ${body?.slice(0, 500)}`);
//         }
//         const data = await res.json();
//         if (Array.isArray(data?.output)) {
//           for (const part of data.output) {
//             if (part?.type === "message" && Array.isArray(part?.content)) {
//               const textPiece = part.content.find((c: any) => c?.type === "output_text" && typeof c?.text === "string");
//               if (textPiece) { raw = textPiece.text as string; break; }
//             }
//           }
//         }
//         if (!raw && typeof data?.output_text === "string") raw = data.output_text;
//         if (!raw && typeof data?.choices?.[0]?.message?.content === "string") raw = data.choices[0].message.content;
//         if (!raw) raw = JSON.stringify(data);
//       }

//       if (taskId) try { await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 70, message: "Parsing response" }); } catch {}
//     let result: any; try { result = JSON.parse(raw); } catch { result = { score: 0, explanation: raw }; }
//     const score = Number(result?.score ?? 0);
//     const explanation = String(result?.explanation ?? "");

//     await ctx.runMutation((internal as any).matches.saveMatch, {
//       candidateId,
//       jobId,
//       model: mdl,
//       score: Math.max(0, Math.min(1, score)),
//       explanation,
//       metadata: { model: mdl, prompt, config },
//       updatedAt: Date.now(),
//     });
//       if (taskId) try { await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 100, message: "Done" }); } catch {}
//       return { score: Math.max(0, Math.min(1, score)), explanation };
//     } catch (err: any) {
//       const message = typeof err?.message === "string" ? err.message : String(err);
//       if (taskId) try { await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 100, message }); } catch {}
//       throw err;
//     }
//   },
// });


// export const summarizeCv = internalAction({
//   args: {
//     candidateId: v.optional(v.id("candidates")),
//     resumeUrl: v.optional(v.string()),
//     model: v.optional(v.string()),
//     taskId: v.optional(v.string()),
//   },
//   returns: v.object({ ok: v.boolean(), summary: v.optional(v.any()) }),
//   handler: async (ctx, { candidateId, resumeUrl, model, taskId }) => {
//     if (taskId) try { await ctx.runMutation(internal.tasks.markStarted, { taskId }); } catch {}
//     const apiKey = process.env.OPENAI_API_KEY;
//     if (!apiKey) throw new Error("OPENAI_API_KEY not set");
//     if (SIMULATE_SLOW) await sleep(randomDelayMs());

//     // Resolve resume URL from source data if absent
//     if (!resumeUrl && candidateId) {
//       try {
//         const rows: any[] = await ctx.runQuery((api as any).candidates.getSourceDataByCandidateIds, { candidateIds: [candidateId] });
//         const src: any = rows?.[0] ?? {};
//         const cvObj = src?.cv;
//         const fromCv = typeof cvObj?.sourceUrl === "string" ? cvObj.sourceUrl : undefined;
//         resumeUrl = fromCv ?? resumeUrl;
//       } catch {}
//     }

//     if (!resumeUrl) {
//       return { ok: false } as any;
//     }

//     // Upload PDF to OpenAI Files API (resumeUrl provided as argument or via caller; we do not persist URL)
//     let fileId: string | undefined;
//     try {
//       const res = await fetch(resumeUrl);
//       if (!res.ok) throw new Error(`CV fetch failed: ${res.status}`);
//       const bytes = new Uint8Array(await res.arrayBuffer());
//       const form = new FormData();
//       const contentType = res.headers.get("content-type") || "application/pdf";
//       const blob = new Blob([bytes], { type: contentType });
//       form.append("file", blob, "resume.pdf");
//       form.append("purpose", "assistants");
//       const upload = await fetch("https://api.openai.com/v1/files", {
//         method: "POST",
//         headers: { Authorization: `Bearer ${apiKey}` },
//         body: form,
//       });
//       if (!upload.ok) throw new Error(`OpenAI file upload failed: ${upload.status}`);
//       const uploaded: OpenAIFile = await upload.json();
//       fileId = uploaded.id;
//       if (taskId) try { await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 20, message: "Uploaded CV" }); } catch {}
//     } catch (e) {
//       throw e;
//     }

//     const chosenModel = (model ?? "gpt-5").trim();
//     const instructions = `You are a resume parsing assistant. Read the attached CV and return STRICT JSON with the following shape (no prose):\n{\n  "summary": string,\n  "contact": { "name": string?, "email": string?, "phone": string?, "location": string? },\n  "education": [ { "institution": string?, "degree": string?, "field": string?, "startDate": string?, "endDate": string? } ],\n  "workExperience": [ { "company": string?, "title": string?, "startDate": string?, "endDate": string?, "responsibilities": string[]? } ],\n  "skills": [ { "name": string } ],\n  "certifications": string[]?,\n  "languages": string[]?,\n  "projects": [ { "name": string?, "description": string? } ]\n}`;

//     const input: any = [
//       { role: "user", content: [
//         { type: "input_text", text: instructions },
//         ...(fileId ? [{ type: "input_file", file_id: fileId }] : []),
//       ]},
//     ];

//     // Avoid strict JSON schema to prevent API 400s; use json_object directly
//     const jsonSchema = null as any;

//     const makeReq = async (mdl: string, fmt: any) =>
//       await fetch("https://api.openai.com/v1/responses", {
//         method: "POST",
//         headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ model: mdl, input, ...(fmt ? { text: { format: fmt } } : {}) }),
//       });

//     let resp = await makeReq(chosenModel, { type: "json_object" });
//     if (!resp.ok) resp = await makeReq("gpt-4o-mini", { type: "json_object" });
//     if (!resp.ok) throw new Error(`OpenAI response failed: ${resp.status}`);
//     const data = await resp.json();
//     let raw: string | null = null;
//     if (Array.isArray(data?.output)) {
//       for (const part of data.output) {
//         if (part?.type === "message" && Array.isArray(part?.content)) {
//           const textPiece = part.content.find((c: any) => c?.type === "output_text" && typeof c?.text === "string");
//           if (textPiece) { raw = textPiece.text as string; break; }
//         }
//       }
//     }
//     if (!raw && typeof data?.output_text === "string") raw = data.output_text;
//     if (!raw && typeof data?.choices?.[0]?.message?.content === "string") raw = data.choices[0].message.content;
//     if (!raw) raw = JSON.stringify(data);
//     const fence = /```(?:json)?\s*([\s\S]*?)```/m; const m = raw.match(fence); if (m && m[1]) raw = m[1];
//     let summary: any; try { summary = JSON.parse(raw); } catch { summary = { summary: raw }; }

//     if (candidateId) {
//       try {
//         // Merge into candidateSourceData.cv
//         const rows: any[] = await ctx.runQuery((api as any).candidates.getSourceDataByCandidateIds, { candidateIds: [candidateId] });
//         const src: any = rows?.[0] ?? {};
//         const existingCv: any = src?.cv ?? {};
//         const newCv = { ...existingCv, hasCv: existingCv?.hasCv ?? true, summary };
//         await ctx.runMutation((internal as any).candidates.upsertCandidateSourceData, {
//           candidateId,
//           cv: newCv,
//           updatedAt: Date.now(),
//         });
//         try { await ctx.runMutation((internal as any).candidates.setCandidateProcessingStatus, { candidateId, processingStatus: "cv_summarized" }); } catch {}
//       } catch {}
//     }

//     if (taskId) try { await ctx.runMutation(internal.tasks.updateProgress, { taskId, progress: 100, message: "CV summarized" }); } catch {}
//     return { ok: true, summary } as any;
//   },
// });

