// Audience groups, made and changed in one way wherever staff do it: the
// Audience page, a campaign's audience picker or an opportunity. A name
// that already exists (ignoring case and spaces) reuses that group rather
// than making a second one with the same name.
import { adminDb } from "@/lib/admin-utils";

export interface AudienceGroup { id: string; name: string; description?: string | null }

const key = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export async function createAudienceGroup(name: string, description?: string | null): Promise<{ group: AudienceGroup; reused: boolean }> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Give the group a name");
  const { data: existing, error: readError } = await adminDb().from("audience_groups").select("id, name, description");
  if (readError) throw readError;
  const same = (existing ?? []).find((g: AudienceGroup) => key(g.name) === key(clean));
  if (same) return { group: same, reused: true };
  const { data, error } = await adminDb()
    .from("audience_groups")
    .insert({ name: clean, description: description?.trim() || null })
    .select("id, name, description")
    .single();
  if (error) throw error;
  return { group: data as AudienceGroup, reused: false };
}

export async function renameAudienceGroup(id: string, name: string, description?: string | null) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Give the group a name");
  const { data: existing } = await adminDb().from("audience_groups").select("id, name");
  if ((existing ?? []).some((g: AudienceGroup) => g.id !== id && key(g.name) === key(clean))) {
    throw new Error("Another group already has that name");
  }
  const { error } = await adminDb().from("audience_groups").update({ name: clean, description: description?.trim() || null }).eq("id", id);
  if (error) throw error;
}

/** Deletes the group and its memberships. The people stay in any other group. */
export async function deleteAudienceGroup(id: string) {
  const { error } = await adminDb().from("audience_groups").delete().eq("id", id);
  if (error) throw error;
}
