import { supabase } from "./supabase";
import { Creative, CreativeTags, DriveFolder, Project, ProjectMember, ProjectFolder, Campaign, Deliverable, ProjectMemberRole } from "@/types";

// ─── SYNC STATE ──────────────────────────────────────────────────────────────

export async function getSyncState() {
  const { data } = await supabase
    .from("sync_state")
    .select("*")
    .single();
  return data;
}

export async function updateSyncState(patch: Record<string, unknown>) {
  await supabase
    .from("sync_state")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // update single row
}

// ─── CREATIVES ───────────────────────────────────────────────────────────────

export async function upsertCreatives(creatives: Creative[]) {
  const rows = creatives.map((c) => ({
    id: c.id,
    folder_id: c.folderId,
    folder_name: c.folderName,
    name: c.name,
    mime_type: c.mimeType,
    file_type: c.fileType,
    size_bytes: c.size ? parseFloat(c.size) : null,
    created_time: c.createdTime,
    modified_time: c.modifiedTime,
    web_view_link: c.webViewLink,
    tag_content_type: c.tags.contentType,
    tag_platforms: c.tags.platforms,
    tag_status: c.tags.status,
    tag_custom: c.tags.custom,
    indexed_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("creatives")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: false });

  if (error) throw error;
}

export async function updateCreativeTags(id: string, tags: CreativeTags) {
  const { error } = await supabase
    .from("creatives")
    .update({
      tag_content_type: tags.contentType,
      tag_platforms: tags.platforms,
      tag_status: tags.status,
      tag_custom: tags.custom,
      tagged_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function updateCreativeThumbnailUrl(id: string, url: string) {
  await supabase.from("creatives").update({ thumbnail_url: url }).eq("id", id);
}

export async function updateCreativeName(id: string, name: string) {
  const { error } = await supabase
    .from("creatives")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}

export async function moveCreative(id: string, newFolderId: string, newFolderName: string) {
  const { error } = await supabase
    .from("creatives")
    .update({ folder_id: newFolderId, folder_name: newFolderName })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCreative(id: string) {
  const { error } = await supabase
    .from("creatives")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCreatives(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("creatives")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

export async function getCreativeById(id: string): Promise<Creative | null> {
  const { data } = await supabase.from("creatives").select("*").eq("id", id).single();
  return data ? dbRowToCreative(data) : null;
}

// Returns the creative if the email can access it, null if not found or no permission.
// Gate: must be a team member; if creative belongs to a project, must be a project member.
export async function resolveAccessibleCreative(email: string, id: string): Promise<Creative | null> {
  const [creative, globalRole] = await Promise.all([
    getCreativeById(id),
    getGlobalRole(email),
  ]);
  if (!creative) return null;
  if (!globalRole) return null; // not a team member
  if (creative.projectId && globalRole !== "admin") {
    const { data } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", creative.projectId)
      .eq("email", email)
      .single();
    if (!data) return null;
  }
  return creative;
}

// Returns the project_id for a folder registered in project_folders, or null if unknown.
export async function getProjectIdByFolderId(folderId: string): Promise<string | null> {
  const { data } = await supabase
    .from("project_folders")
    .select("project_id")
    .eq("folder_id", folderId)
    .single();
  return (data?.project_id as string) ?? null;
}

// Returns { projectId, folderName } for a registered project folder, or null if unknown.
export async function getProjectFolderRecord(folderId: string): Promise<{ projectId: string; folderName: string } | null> {
  const { data } = await supabase
    .from("project_folders")
    .select("project_id, folder_name")
    .eq("folder_id", folderId)
    .single();
  if (!data) return null;
  return { projectId: data.project_id as string, folderName: data.folder_name as string };
}

export interface CreativesPageOptions {
  cursor?: number; // offset
  limit?: number;
  folderId?: string;
  fileType?: "video" | "image" | "other" | "all";
  status?: string;
  contentType?: string;
  platform?: string;
  customTag?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "recent" | "oldest" | "name_az" | "name_za" | "size_desc" | "duration_desc" | "duration_asc";
  minSizeBytes?: number;
  maxSizeBytes?: number;
  minDurSecs?: number;
  maxDurSecs?: number;
  // null = no restriction (admin); string[] = only these project IDs + project-less creatives
  allowedProjectIds?: string[] | null;
}

const SORT_MAP: Record<string, { col: string; asc: boolean }> = {
  recent:        { col: "modified_time",    asc: false },
  oldest:        { col: "created_time",     asc: true  },
  name_az:       { col: "name",             asc: true  },
  name_za:       { col: "name",             asc: false },
  size_desc:     { col: "size_bytes",       asc: false },
  duration_desc: { col: "duration_seconds", asc: false },
  duration_asc:  { col: "duration_seconds", asc: true  },
};

export async function getCreativesPage(opts: CreativesPageOptions): Promise<{
  creatives: Creative[];
  total: number;
  folders: DriveFolder[];
}> {
  const limit = opts.limit ?? 50;
  const offset = opts.cursor ?? 0;
  const { col, asc } = SORT_MAP[opts.sort ?? "recent"] ?? SORT_MAP.recent;

  let q = supabase
    .from("creatives")
    .select("*", { count: "exact" })
    .order(col, { ascending: asc })
    .range(offset, offset + limit - 1);

  if (opts.folderId) q = q.eq("folder_id", opts.folderId);
  if (opts.fileType && opts.fileType !== "all") q = q.eq("file_type", opts.fileType);
  if (opts.status && opts.status !== "all") q = q.eq("tag_status", opts.status);
  if (opts.contentType && opts.contentType !== "all") q = q.eq("tag_content_type", opts.contentType);
  if (opts.platform && opts.platform !== "all") q = q.contains("tag_platforms", [opts.platform]);
  if (opts.search) q = q.ilike("name", `%${opts.search}%`);
  if (opts.customTag) q = q.contains("tag_custom", [opts.customTag]);
  if (opts.dateFrom) q = q.gte("created_time", opts.dateFrom);
  if (opts.dateTo) {
    const d = new Date(opts.dateTo);
    d.setHours(23, 59, 59, 999);
    q = q.lte("created_time", d.toISOString());
  }
  if (opts.minSizeBytes != null) q = q.gte("size_bytes", opts.minSizeBytes);
  if (opts.maxSizeBytes != null) q = q.lte("size_bytes", opts.maxSizeBytes);
  if (opts.minDurSecs != null) q = q.gte("duration_seconds", opts.minDurSecs);
  if (opts.maxDurSecs != null) q = q.lte("duration_seconds", opts.maxDurSecs);

  // Access control: restrict to project-less creatives + allowed project IDs (null = admin, no restriction)
  if (opts.allowedProjectIds !== null && opts.allowedProjectIds !== undefined) {
    if (opts.allowedProjectIds.length === 0) {
      q = q.is("project_id", null);
    } else {
      q = q.or(`project_id.is.null,project_id.in.(${opts.allowedProjectIds.join(",")})`);
    }
  }

  const { data, count, error } = await q;
  if (error) {
    // PGRST103: offset beyond total rows — return empty page instead of throwing
    if (error.code === "PGRST103") {
      return { creatives: [], total: 0, folders: [] };
    }
    console.error("getCreativesPage query error:", error.message, error.details);
    throw new Error(error.message ?? JSON.stringify(error));
  }

  const creatives: Creative[] = (data ?? []).map(dbRowToCreative);

  // Fetch distinct folders only on first page (no per-filter restriction — show all available)
  let folders: DriveFolder[] = [];
  if (offset === 0) {
    const { data: folderData, error: folderError } = await supabase
      .from("creatives")
      .select("folder_id, folder_name")
      .neq("folder_id", "")
      .limit(2000);

    if (folderError) console.error("getCreativesPage folders error:", folderError.message);

    if (folderData) {
      const seen = new Set<string>();
      folders = folderData
        .filter((r) => r.folder_id && !seen.has(r.folder_id) && seen.add(r.folder_id))
        .map((r) => ({ id: r.folder_id as string, name: r.folder_name as string }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  return { creatives, total: count ?? 0, folders };
}

function dbRowToCreative(row: Record<string, unknown>): Creative {
  return {
    id: row.id as string,
    name: row.name as string,
    mimeType: row.mime_type as string,
    fileType: row.file_type as "video" | "image" | "other",
    folderId: row.folder_id as string,
    folderName: row.folder_name as string,
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    webViewLink: row.web_view_link as string | null,
    size: row.size_bytes ? formatSize(row.size_bytes as number) : null,
    sizeBytes: (row.size_bytes as number) ?? null,
    createdTime: row.created_time as string,
    modifiedTime: row.modified_time as string,
    projectId: (row.project_id as string) ?? null,
    durationSeconds: (row.duration_seconds as number) ?? null,
    tags: {
      contentType: (row.tag_content_type as string) as Creative["tags"]["contentType"],
      platforms: ((row.tag_platforms as string[]) ?? []) as Creative["tags"]["platforms"],
      status: (row.tag_status as string) as Creative["tags"]["status"],
      custom: (row.tag_custom as string[]) ?? [],
    },
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

// ─── ANALYSIS ────────────────────────────────────────────────────────────────

import { VideoAnalysis } from "@/types";

export async function getAnalysis(creativeId: string) {
  const { data } = await supabase
    .from("creative_analyses")
    .select("*")
    .eq("creative_id", creativeId)
    .single();
  return data ?? null;
}

export async function saveAnalysis(creativeId: string, analysis: VideoAnalysis, transcript: string | undefined, model: string) {
  const { error } = await supabase
    .from("creative_analyses")
    .upsert({
      creative_id: creativeId,
      analyzed_at: new Date().toISOString(),
      model,
      status: "done",
      transcript: transcript ?? null,
      analysis,
    }, { onConflict: "creative_id" });
  if (error) throw error;

  // Keep duration_seconds on creatives in sync with analysis result
  if (analysis.duration_seconds != null) {
    await supabase
      .from("creatives")
      .update({ duration_seconds: Math.round(analysis.duration_seconds) })
      .eq("id", creativeId);
  }
}

export async function markAnalysisProcessing(creativeId: string) {
  await supabase
    .from("creative_analyses")
    .upsert({ creative_id: creativeId, status: "processing", analyzed_at: new Date().toISOString(), analysis: {} }, { onConflict: "creative_id" });
}

// ─── COPIES ──────────────────────────────────────────────────────────────────

export async function saveCopyGeneration(data: {
  creativeId: string;
  generatedBy: string;
  instructions: string;
  platformTarget: string;
  output: unknown;
  model: string;
}) {
  const { error } = await supabase.from("copy_generations").insert({
    creative_id: data.creativeId,
    generated_by: data.generatedBy,
    instructions: data.instructions,
    platform_target: data.platformTarget,
    output: data.output,
    model: data.model,
  });
  if (error) throw error;
}

export async function getCopiesForCreative(creativeId: string) {
  const { data } = await supabase
    .from("copy_generations")
    .select("*")
    .eq("creative_id", creativeId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── TEAM ─────────────────────────────────────────────────────────────────────

export async function isTeamMember(email: string): Promise<boolean> {
  const { data } = await supabase
    .from("team_members")
    .select("id")
    .eq("email", email)
    .single();
  return !!data;
}

export async function getTeamMembers() {
  const { data } = await supabase
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

export async function addTeamMember(email: string, role: string, invitedBy: string) {
  const { error } = await supabase
    .from("team_members")
    .upsert({ email, role, invited_by: invitedBy }, { onConflict: "email" });
  if (error) throw error;
}

export async function getGlobalRole(email: string): Promise<string | null> {
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("email", email)
    .single();
  return data?.role ?? null;
}

// ─── PROJECTS ────────────────────────────────────────────────────────────────

function dbRowToProject(row: Record<string, unknown>, myRole?: string | null): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    type: row.type as Project["type"],
    status: row.status as Project["status"],
    clientName: (row.client_name as string) ?? null,
    brief: (row.brief as string) ?? null,
    coverColor: (row.cover_color as string) ?? "#6366f1",
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    myRole: (myRole as ProjectMemberRole) ?? null,
  };
}

export async function getProjectsForUser(email: string): Promise<Project[]> {
  const globalRole = await getGlobalRole(email);

  let projectIds: string[] | null = null;
  if (!globalRole) {
    // Only project-specific access
    const { data: memberRows } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("email", email);
    projectIds = (memberRows ?? []).map((r) => r.project_id as string);
    if (projectIds.length === 0) return [];
  }

  let q = supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (projectIds) q = q.in("id", projectIds);

  const { data } = await q;
  if (!data) return [];

  // Get per-project role for non-admins
  const roleMap: Record<string, string> = {};
  if (!globalRole) {
    const { data: memberRows } = await supabase
      .from("project_members")
      .select("project_id, role")
      .eq("email", email)
      .in("project_id", data.map((r) => r.id));
    (memberRows ?? []).forEach((r) => { roleMap[r.project_id as string] = r.role as string; });
  }

  return data.map((row) => dbRowToProject(row, globalRole ?? roleMap[row.id as string] ?? null));
}

export async function getProject(id: string): Promise<Project | null> {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  return data ? dbRowToProject(data) : null;
}

export async function createProject(input: {
  name: string;
  description?: string;
  type: string;
  status?: string;
  clientName?: string;
  brief?: string;
  coverColor?: string;
  startDate?: string;
  endDate?: string;
  createdBy: string;
}): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      status: input.status ?? "draft",
      client_name: input.clientName ?? null,
      brief: input.brief ?? null,
      cover_color: input.coverColor ?? "#6366f1",
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return dbRowToProject(data);
}

export async function updateProject(id: string, patch: Partial<{
  name: string;
  description: string;
  type: string;
  status: string;
  clientName: string;
  brief: string;
  coverColor: string;
  startDate: string;
  endDate: string;
}>) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined)        update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.type !== undefined)        update.type = patch.type;
  if (patch.status !== undefined)      update.status = patch.status;
  if (patch.clientName !== undefined)  update.client_name = patch.clientName;
  if (patch.brief !== undefined)       update.brief = patch.brief;
  if (patch.coverColor !== undefined)  update.cover_color = patch.coverColor;
  if (patch.startDate !== undefined)   update.start_date = patch.startDate || null;
  if (patch.endDate !== undefined)     update.end_date = patch.endDate || null;

  const { error } = await supabase.from("projects").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ─── PROJECT MEMBERS ─────────────────────────────────────────────────────────

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("invited_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    projectId: r.project_id as string,
    email: r.email as string,
    name: (r.name as string) ?? null,
    role: r.role as ProjectMemberRole,
    invitedBy: r.invited_by as string,
    invitedAt: r.invited_at as string,
  }));
}

export async function addProjectMember(projectId: string, email: string, role: string, invitedBy: string, name?: string) {
  const { error } = await supabase
    .from("project_members")
    .upsert({ project_id: projectId, email, role, invited_by: invitedBy, name: name ?? null }, { onConflict: "project_id,email" });
  if (error) throw error;
}

export async function updateProjectMemberRole(projectId: string, email: string, role: string) {
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("email", email);
  if (error) throw error;
}

export async function removeProjectMember(projectId: string, email: string) {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("email", email);
  if (error) throw error;
}

export async function getUserProjectRole(email: string, projectId: string): Promise<ProjectMemberRole | null> {
  const global = await getGlobalRole(email);
  if (global === "admin") return "admin";
  const { data } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("email", email)
    .single();
  return (data?.role as ProjectMemberRole) ?? null;
}

// ─── PROJECT FOLDERS ─────────────────────────────────────────────────────────

export async function getProjectFolders(projectId: string): Promise<ProjectFolder[]> {
  const { data } = await supabase
    .from("project_folders")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    projectId: r.project_id as string,
    folderId: r.folder_id as string,
    folderName: r.folder_name as string,
    purpose: r.purpose as ProjectFolder["purpose"],
    createdAt: r.created_at as string,
  }));
}

export async function addProjectFolder(projectId: string, folderId: string, folderName: string, purpose: string) {
  const { error } = await supabase
    .from("project_folders")
    .upsert({ project_id: projectId, folder_id: folderId, folder_name: folderName, purpose }, { onConflict: "project_id,folder_id" });
  if (error) throw error;
}

export async function removeProjectFolder(projectId: string, folderId: string) {
  const { error } = await supabase
    .from("project_folders")
    .delete()
    .eq("project_id", projectId)
    .eq("folder_id", folderId);
  if (error) throw error;
}

// ─── CAMPAIGNS ───────────────────────────────────────────────────────────────

function dbRowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    platform: row.platform as Campaign["platform"],
    type: row.type as Campaign["type"],
    status: row.status as Campaign["status"],
    objective: (row.objective as Campaign["objective"]) ?? null,
    budget: (row.budget as number) ?? null,
    spent: (row.spent as number) ?? 0,
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    impressions: (row.impressions as number) ?? 0,
    clicks: (row.clicks as number) ?? 0,
    conversions: (row.conversions as number) ?? 0,
    roas: (row.roas as number) ?? null,
    ctr: (row.ctr as number) ?? null,
    cpm: (row.cpm as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getCampaigns(projectId: string): Promise<Campaign[]> {
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map(dbRowToCampaign);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data } = await supabase.from("campaigns").select("*").eq("id", id).single();
  return data ? dbRowToCampaign(data) : null;
}

export async function createCampaign(input: {
  projectId: string;
  name: string;
  platform: string;
  type: string;
  objective?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdBy: string;
}): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      project_id: input.projectId,
      name: input.name,
      platform: input.platform,
      type: input.type,
      objective: input.objective ?? null,
      budget: input.budget ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return dbRowToCampaign(data);
}

export async function updateCampaign(id: string, patch: Partial<{
  name: string;
  platform: string;
  type: string;
  status: string;
  objective: string;
  budget: number;
  startDate: string;
  endDate: string;
  notes: string;
}>) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined)      update.name = patch.name;
  if (patch.platform !== undefined)  update.platform = patch.platform;
  if (patch.type !== undefined)      update.type = patch.type;
  if (patch.status !== undefined)    update.status = patch.status;
  if (patch.objective !== undefined) update.objective = patch.objective || null;
  if (patch.budget !== undefined)    update.budget = patch.budget || null;
  if (patch.startDate !== undefined) update.start_date = patch.startDate || null;
  if (patch.endDate !== undefined)   update.end_date = patch.endDate || null;
  if (patch.notes !== undefined)     update.notes = patch.notes || null;
  const { error } = await supabase.from("campaigns").update(update).eq("id", id);
  if (error) throw error;
}

export async function updateCampaignMetrics(id: string, metrics: {
  impressions?: number;
  clicks?: number;
  conversions?: number;
  spent?: number;
  roas?: number;
  ctr?: number;
  cpm?: number;
}) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  Object.entries(metrics).forEach(([k, v]) => { if (v !== undefined) update[k] = v; });
  const { error } = await supabase.from("campaigns").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

export async function addCreativeToCampaign(campaignId: string, creativeId: string) {
  const { error } = await supabase
    .from("campaign_creatives")
    .upsert({ campaign_id: campaignId, creative_id: creativeId }, { onConflict: "campaign_id,creative_id" });
  if (error) throw error;
}

export async function removeCreativeFromCampaign(campaignId: string, creativeId: string) {
  const { error } = await supabase
    .from("campaign_creatives")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("creative_id", creativeId);
  if (error) throw error;
}

export async function getCampaignCreativeIds(campaignId: string): Promise<string[]> {
  const { data } = await supabase
    .from("campaign_creatives")
    .select("creative_id")
    .eq("campaign_id", campaignId)
    .limit(1000);
  return (data ?? []).map((r) => r.creative_id as string);
}

// ─── DELIVERABLES ────────────────────────────────────────────────────────────

function dbRowToDeliverable(row: Record<string, unknown>): Deliverable {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    campaignId: (row.campaign_id as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? null,
    assignedTo: (row.assigned_to as string) ?? null,
    role: (row.role as Deliverable["role"]) ?? null,
    type: row.type as Deliverable["type"],
    status: row.status as Deliverable["status"],
    dueDate: (row.due_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    reviewerNotes: (row.reviewer_notes as string) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getDeliverable(id: string): Promise<Deliverable | null> {
  const { data } = await supabase.from("deliverables").select("*").eq("id", id).single();
  return data ? dbRowToDeliverable(data) : null;
}

export async function getDeliverables(projectId: string, filters?: {
  assignedTo?: string;
  status?: string;
  campaignId?: string;
}): Promise<Deliverable[]> {
  let q = supabase
    .from("deliverables")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (filters?.assignedTo) q = q.eq("assigned_to", filters.assignedTo);
  if (filters?.status)     q = q.eq("status", filters.status);
  if (filters?.campaignId) q = q.eq("campaign_id", filters.campaignId);

  const { data } = await q;
  return (data ?? []).map(dbRowToDeliverable);
}

export async function createDeliverable(input: {
  projectId: string;
  campaignId?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  role?: string;
  type: string;
  dueDate?: string;
  notes?: string;
  createdBy: string;
}): Promise<Deliverable> {
  const { data, error } = await supabase
    .from("deliverables")
    .insert({
      project_id: input.projectId,
      campaign_id: input.campaignId ?? null,
      title: input.title,
      description: input.description ?? null,
      assigned_to: input.assignedTo ?? null,
      role: input.role ?? null,
      type: input.type,
      due_date: input.dueDate ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return dbRowToDeliverable(data);
}

export async function updateDeliverable(id: string, patch: Partial<{
  title: string;
  description: string;
  assignedTo: string;
  role: string;
  type: string;
  dueDate: string;
  notes: string;
  campaignId: string;
}>) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined)       update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description || null;
  if (patch.assignedTo !== undefined)  update.assigned_to = patch.assignedTo || null;
  if (patch.role !== undefined)        update.role = patch.role || null;
  if (patch.type !== undefined)        update.type = patch.type;
  if (patch.dueDate !== undefined)     update.due_date = patch.dueDate || null;
  if (patch.notes !== undefined)       update.notes = patch.notes || null;
  if (patch.campaignId !== undefined)  update.campaign_id = patch.campaignId || null;
  const { error } = await supabase.from("deliverables").update(update).eq("id", id);
  if (error) throw error;
}

export async function updateDeliverableStatus(id: string, status: string, reviewerNotes?: string) {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (reviewerNotes !== undefined) update.reviewer_notes = reviewerNotes || null;
  const { error } = await supabase.from("deliverables").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteDeliverable(id: string) {
  const { error } = await supabase.from("deliverables").delete().eq("id", id);
  if (error) throw error;
}

export async function getDeliverableStats(projectId: string): Promise<{ total: number; done: number; review: number; approved: number }> {
  const { data } = await supabase
    .from("deliverables")
    .select("status")
    .eq("project_id", projectId);
  const rows = data ?? [];
  return {
    total: rows.length,
    done: rows.filter((r) => r.status === "done").length,
    review: rows.filter((r) => r.status === "review").length,
    approved: rows.filter((r) => r.status === "approved").length,
  };
}
