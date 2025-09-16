import { Icons } from '@/components/icons';
import { type Id } from '@/lib/convex';

export interface NavItem {
  title: string;
  url: string;
  disabled?: boolean;
  external?: boolean;
  shortcut?: [string, string];
  icon?: keyof typeof Icons;
  label?: string;
  description?: string;
  isActive?: boolean;
  items?: NavItem[];
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

export interface NavItemWithOptionalChildren extends NavItem {
  items?: NavItemWithChildren[];
}

export interface FooterItem {
  title: string;
  items: {
    title: string;
    href: string;
    external?: boolean;
  }[];
}

export type MainNavItem = NavItemWithOptionalChildren;

export type SidebarNavItem = NavItemWithChildren;


// Processing status shapes from Convex queries (teamtailor.ts)
export interface InProcessItem {
  kind: string;
  state: string;
}

export interface JobProcessingStatus {
  jobId: Id<"jobs">;
  processed: boolean;
  components: { profile: boolean; embeddings: boolean; sourceData: boolean };
  inProcess: InProcessItem[];
  status: {
    imported: boolean;
    cv: boolean;
    assessment: boolean;
    hubert: boolean;
    profile: boolean;
    embeddings: boolean;
  };
}

export interface CandidateProcessingStatus {
  candidateId: Id<"candidates">;
  processed: boolean;
  components: { profile: boolean; embeddings: boolean; sourceData: boolean };
  inProcess: InProcessItem[];
  failed?: boolean;
  failedReason?: string;
  status: {
    imported: boolean;
    cv: boolean;
    assessment: boolean;
    hubert: boolean;
    profile: boolean;
    embeddings: boolean;
  };
}

export interface JobProfileDoc {
  jobId: Id<"jobs">;
  summary?: string;
  responsibilities?: string[];
  requirements?: string[];
  skills?: Array<{ name: string; score: number }>;
  raw?: string;
  metadata?: unknown;
  updatedAt: number;
}
