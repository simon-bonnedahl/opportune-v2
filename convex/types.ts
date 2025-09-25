import { Infer, v } from "convex/values";

export const role = v.union(
    v.literal("TA"),
    v.literal("BM"),
    v.literal("AM"),
    v.literal("ADMIN"),
  );
  
  export type Role = Infer<typeof role>;


export const taskType = v.union(
    v.literal("import"),
    v.literal("sync"),
    v.literal("build_profile"),
    v.literal("embed_profile"),
    v.literal("match"),
  );

export const taskStatus = v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("succeeded"),
    v.literal("failed"),
    v.literal("canceled"),
  );
  
  export type TaskType = Infer<typeof taskType>;

// Teamtailor API types
export interface TeamtailorCandidateAttributes {
  connected: boolean;
  'consent-future-jobs-at': string | null;
  'created-at': string;
  email: string;
  'facebook-id': string;
  'first-name': string;
  internal: boolean;
  'last-name': string;
  'linkedin-uid': string;
  'linkedin-url': string | null;
  'original-resume': string | null;
  phone: string | null;
  picture: string | null;
  pitch: string | null;
  'referring-site': string | null;
  'referring-url': string | null;
  referred: boolean;
  resume: string | null;
  'resume-summary': string | null;
  sourced: boolean;
  unsubscribed: boolean;
  'updated-at': string;
  'restricted-at': string | null;
  'facebook-profile': string | null;
  'linkedin-profile': string | null;
  tags: any[];
}

export interface TeamtailorCandidateLinks {
  self: string;
}

export interface TeamtailorCandidateRelationshipLinks {
  self: string;
  related: string;
}

export interface TeamtailorCandidateRelationships {
  activities: { links: TeamtailorCandidateRelationshipLinks };
  division: { links: TeamtailorCandidateRelationshipLinks };
  department: { links: TeamtailorCandidateRelationshipLinks };
  role: { links: TeamtailorCandidateRelationshipLinks };
  regions: { links: TeamtailorCandidateRelationshipLinks };
  'job-applications': { links: TeamtailorCandidateRelationshipLinks };
  questions: { links: TeamtailorCandidateRelationshipLinks };
  answers: { links: TeamtailorCandidateRelationshipLinks };
  locations: { links: TeamtailorCandidateRelationshipLinks };
  uploads: { links: TeamtailorCandidateRelationshipLinks };
  'custom-field-values': { links: TeamtailorCandidateRelationshipLinks };
  'partner-results': { links: TeamtailorCandidateRelationshipLinks };
  'nps-responses': { links: TeamtailorCandidateRelationshipLinks };
  'form-answers': { links: TeamtailorCandidateRelationshipLinks };
  onboardings: { links: TeamtailorCandidateRelationshipLinks };
}

export interface TeamtailorCandidate {
  id: string;
  type: 'candidates';
  links: TeamtailorCandidateLinks;
  attributes: TeamtailorCandidateAttributes;
  relationships: TeamtailorCandidateRelationships;
}

// Teamtailor Job API types
export interface TeamtailorJobPicture {
  original: string;
  standard: string;
  thumb: string;
}

export interface TeamtailorJobAttributes {
  "additional-files-requirement": string;
  "apply-button-text": string;
  body: string;
  "cover-letter-requirement": string;
  "created-at": string;
  currency: string;
  "end-date": string | null;
  "external-application-url": string | null;
  "human-status": string;
  internal: boolean;
  "internal-name": string;
  "language-code": string;
  mailbox: string;
  "name-requirement": string;
  "phone-requirement": string;
  picture: TeamtailorJobPicture | null;
  pinned: boolean;
  pitch: string;
  "recruiter-email": string;
  "remote-status": string;
  "resume-requirement": string;
  "sharing-image-layout": string;
  "start-date": string | null;
  status: string;
  tags: any[];
  "template-name": string | null;
  title: string;
  "updated-at": string;
}

export interface TeamtailorJobLinks {
  "careersite-job-apply-iframe-url": string;
  "careersite-job-apply-url": string;
  "careersite-job-internal-url": string;
  "careersite-job-url": string;
  self: string;
}

export interface TeamtailorJobRelationshipLinks {
  related: string;
  self: string;
}

export interface TeamtailorJobRelationships {
  activities: { links: TeamtailorJobRelationshipLinks };
  candidates: { links: TeamtailorJobRelationshipLinks };
  colleagues: { links: TeamtailorJobRelationshipLinks };
  "custom-field-values": { links: TeamtailorJobRelationshipLinks };
  "custom-fields": { links: TeamtailorJobRelationshipLinks };
  department: { links: TeamtailorJobRelationshipLinks };
  division: { links: TeamtailorJobRelationshipLinks };
  location: { links: TeamtailorJobRelationshipLinks };
  locations: { links: TeamtailorJobRelationshipLinks };
  "picked-questions": { links: TeamtailorJobRelationshipLinks };
  questions: { links: TeamtailorJobRelationshipLinks };
  regions: { links: TeamtailorJobRelationshipLinks };
  requisition: { links: TeamtailorJobRelationshipLinks };
  role: { links: TeamtailorJobRelationshipLinks };
  stages: { links: TeamtailorJobRelationshipLinks };
  team: { links: TeamtailorJobRelationshipLinks };
  "team-memberships": { links: TeamtailorJobRelationshipLinks };
  user: { links: TeamtailorJobRelationshipLinks };
}

export interface TeamtailorJob {
  id: string;
  type: 'jobs';
  links: TeamtailorJobLinks;
  attributes: TeamtailorJobAttributes;
  relationships: TeamtailorJobRelationships;
}