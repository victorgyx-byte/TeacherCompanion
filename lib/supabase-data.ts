import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "@/lib/types";

const TABLES = [
  "research_entries",
  "lesson_ideas",
  "reflection_entries",
  "belief_cards",
  "philosophy_documents"
] as const;

export async function loadUserData(client: SupabaseClient, userId: string): Promise<AppData> {
  const [research, lessons, reflections, beliefs, docs] = await Promise.all([
    client.from("research_entries").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    client.from("lesson_ideas").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    client.from("reflection_entries").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    client.from("belief_cards").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    client.from("philosophy_documents").select("*").eq("user_id", userId).order("updated_at", { ascending: false })
  ]);

  if (research.error) throw research.error;
  if (lessons.error) throw lessons.error;
  if (reflections.error) throw reflections.error;
  if (beliefs.error) throw beliefs.error;
  if (docs.error) throw docs.error;

  return {
    researchEntries: research.data ?? [],
    lessonIdeas: lessons.data ?? [],
    reflectionEntries: reflections.data ?? [],
    beliefCards: beliefs.data ?? [],
    philosophyDocuments: docs.data ?? [],
    tags: []
  };
}

export async function syncUserData(client: SupabaseClient, data: AppData, userId: string) {
  const batches: Record<(typeof TABLES)[number], unknown[]> = {
    research_entries: data.researchEntries.map((row) => ({ ...row, user_id: userId })),
    lesson_ideas: data.lessonIdeas.map((row) => ({ ...row, user_id: userId })),
    reflection_entries: data.reflectionEntries.map((row) => ({ ...row, user_id: userId })),
    belief_cards: data.beliefCards.map((row) => ({ ...row, user_id: userId })),
    philosophy_documents: data.philosophyDocuments.map((row) => ({ ...row, user_id: userId }))
  };

  for (const tableName of TABLES) {
    const rows = batches[tableName];
    if (!rows.length) continue;
    const { error } = await client.from(tableName).upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}
