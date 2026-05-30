export type ContentType = "UGC" | "testimonio" | "demo" | "educativo" | "producto" | "sin_clasificar";
export type Platform = "Meta" | "TikTok" | "YouTube" | "Instagram" | "sin_sugerencia";
export type CreativeStatus = "listo_para_pautar" | "revisar" | "descartar" | "sin_estado";

export interface CreativeTags {
  contentType: ContentType;
  platforms: Platform[];
  status: CreativeStatus;
  custom: string[];
}

export interface PlatformFitScore {
  score: number;   // 1-10
  notes: string;
}

export interface VideoScene {
  start: number;
  end: number;
  description: string;
  type?: string;
}

export interface VideoAnalysis {
  transcript?: string;
  language?: string;
  duration_seconds?: number;
  visual_summary?: string;
  scenes?: VideoScene[];
  key_messages?: string[];
  emotions?: string[];
  products_shown?: string[];
  hook_strength?: string;
  hook_seconds?: number;
  best_clip?: { start: number; end: number };
  content_type?: string;
  suggested_audience?: string;
  platform_fit?: Record<string, PlatformFitScore>;
  strengths?: string[];
  weaknesses?: string[];
  copy_angles?: string[];
}

export interface Creative {
  id: string;
  name: string;
  mimeType: string;
  fileType: "video" | "image" | "other";
  folderId: string;
  folderName: string;
  thumbnailUrl: string | null;
  webViewLink: string | null;
  size: string | null;
  sizeBytes?: number | null;
  durationSeconds?: number | null;
  createdTime: string;
  modifiedTime: string;
  tags: CreativeTags;
  isTagging?: boolean;
  bunnyVideoId?: string | null;
  bunnyStatus?: string | null;
  analysis?: VideoAnalysis | null;
  analysisStatus?: "processing" | "done" | "error" | null;
  projectId?: string | null;
}

// ─── PROJECTS ────────────────────────────────────────────────────────────────

export type ProjectType = "paid_campaign" | "organic_campaign" | "partner" | "ugc_campaign" | "branding";
export type ProjectStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type ProjectMemberRole = "admin" | "community_manager" | "content_strategist" | "traffic" | "designer" | "editor" | "viewer";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  type: ProjectType;
  status: ProjectStatus;
  clientName: string | null;
  brief: string | null;
  coverColor: string;
  startDate: string | null;
  endDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Computed on fetch
  memberCount?: number;
  campaignCount?: number;
  deliverableStats?: { total: number; done: number; review: number; approved: number };
  myRole?: ProjectMemberRole | null;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  email: string;
  name: string | null;
  role: ProjectMemberRole;
  invitedBy: string;
  invitedAt: string;
}

export interface ProjectFolder {
  id: string;
  projectId: string;
  folderId: string;
  folderName: string;
  purpose: "general" | "creatives" | "designs" | "references" | "approved" | "deliverables";
  createdAt: string;
}

// ─── CAMPAIGNS ───────────────────────────────────────────────────────────────

export type CampaignPlatform = "meta_ads" | "tiktok_ads" | "google_ads" | "instagram_organic" | "tiktok_organic" | "youtube_ads" | "whatsapp";
export type CampaignType = "paid" | "organic";
export type CampaignStatus = "planning" | "production" | "review" | "active" | "paused" | "ended";
export type CampaignObjective = "awareness" | "consideration" | "conversion" | "traffic" | "engagement" | "leads";

export interface Campaign {
  id: string;
  projectId: string;
  name: string;
  platform: CampaignPlatform;
  type: CampaignType;
  status: CampaignStatus;
  objective: CampaignObjective | null;
  budget: number | null;
  spent: number;
  startDate: string | null;
  endDate: string | null;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number | null;
  ctr: number | null;
  cpm: number | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creativeCount?: number;
}

// ─── DELIVERABLES ────────────────────────────────────────────────────────────

export type DeliverableType = "creative_upload" | "copy" | "strategy_doc" | "campaign_setup" | "design" | "video_edit" | "other";
export type DeliverableStatus = "pending" | "in_progress" | "review" | "approved" | "rejected" | "done";

export interface Deliverable {
  id: string;
  projectId: string;
  campaignId: string | null;
  title: string;
  description: string | null;
  assignedTo: string | null;
  role: ProjectMemberRole | null;
  type: DeliverableType;
  status: DeliverableStatus;
  dueDate: string | null;
  notes: string | null;
  reviewerNotes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export type FilterSort = "recent" | "oldest" | "name_az" | "name_za" | "size_desc" | "duration_desc" | "duration_asc";

export interface FilterState {
  fileType: "all" | "video" | "image";
  folderId: string;
  dateFrom: string;
  dateTo: string;
  contentType: ContentType | "all";
  platform: Platform | "all";
  status: CreativeStatus | "all";
  search: string;
  customTag: string;
  sort: FilterSort;
  // Size range (in MB, empty string = no limit)
  minSizeMB: string;
  maxSizeMB: string;
  // Duration range (in seconds, empty string = no limit)
  minDurSecs: string;
  maxDurSecs: string;
}
