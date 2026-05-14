import { keywordScore, truncateWords } from "@/lib/text";
import type { AppData, CompactContextPack, TaskType } from "@/lib/types";

const LIMITS = {
  approvedBeliefs: 5,
  researchSummaries: 5,
  reflectionSummaries: 5,
  lessonIdeaSummaries: 5,
  wordsPerCategory: 420
};

function keywordsFrom(inputText: string, tags: string[]) {
  const words = inputText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
  return [...new Set([...tags.map((tag) => tag.toLowerCase()), ...words.slice(0, 18)])];
}

function capCategoryWords<T extends Record<string, unknown>>(items: T[], fields: Array<keyof T>) {
  let used = 0;
  return items.filter((item) => {
    const words = fields.map((field) => String(item[field] ?? "")).join(" ").split(/\s+/).filter(Boolean).length;
    if (used + words > LIMITS.wordsPerCategory && used > 0) return false;
    used += words;
    return true;
  });
}

export function retrieveRelevantContext(data: AppData, taskType: TaskType, inputText: string, tags: string[] = []) {
  const keywords = keywordsFrom(inputText, tags);
  const scoreTags = (itemTags: string[] = []) => itemTags.filter((tag) => tags.includes(tag)).length * 3;

  const approvedBeliefs = data.beliefCards
    .filter((belief) => belief.status === "approved")
    .map((belief) => ({
      ...belief,
      _score: keywordScore(`${belief.theme} ${belief.teacher_edited_text || belief.belief_statement} ${belief.evidence}`, keywords) + scoreTags([belief.theme])
    }))
    .sort((a, b) => b._score - a._score || b.updated_at.localeCompare(a.updated_at))
    .slice(0, LIMITS.approvedBeliefs);

  const researchSummaries = data.researchEntries
    .map((entry) => ({
      ...entry,
      _score: keywordScore(`${entry.title} ${entry.summary_short} ${entry.key_ideas.join(" ")}`, keywords) + scoreTags(entry.suggested_tags)
    }))
    .sort((a, b) => b._score - a._score || b.updated_at.localeCompare(a.updated_at))
    .slice(0, LIMITS.researchSummaries);

  const reflectionSummaries = data.reflectionEntries
    .map((entry) => ({
      ...entry,
      _score: keywordScore(`${entry.title} ${entry.summary_short} ${entry.key_insight} ${entry.themes.join(" ")}`, keywords) + scoreTags(entry.themes)
    }))
    .sort((a, b) => b._score - a._score || b.updated_at.localeCompare(a.updated_at))
    .slice(0, LIMITS.reflectionSummaries);

  const lessonIdeaSummaries = data.lessonIdeas
    .map((idea) => ({
      ...idea,
      _score: keywordScore(`${idea.title} ${idea.summary_short} ${idea.raw_idea}`, keywords) + scoreTags(idea.suggested_tags)
    }))
    .sort((a, b) => b._score - a._score || b.updated_at.localeCompare(a.updated_at))
    .slice(0, LIMITS.lessonIdeaSummaries);

  return {
    taskType,
    approvedBeliefs,
    researchSummaries,
    reflectionSummaries,
    lessonIdeaSummaries
  };
}

export function buildCompactContextPack(data: AppData, taskType: TaskType, inputText: string, tags: string[] = []): CompactContextPack {
  const relevant = retrieveRelevantContext(data, taskType, inputText, tags);

  // Capture everything, summarise once, retrieve selectively, synthesise only when needed.
  // This compact pack protects speed, cost, and response quality by avoiding raw archives and full-library prompts.
  return {
    current_user_task: taskType,
    selected_tags: tags.slice(0, 8),
    relevant_approved_beliefs: capCategoryWords(
      relevant.approvedBeliefs.map((belief) => ({
        id: belief.id,
        theme: belief.theme,
        teacher_edited_text: truncateWords(belief.teacher_edited_text || belief.belief_statement, 55),
        belief_statement: truncateWords(belief.belief_statement, 55),
        evidence: truncateWords(belief.evidence, 45)
      })),
      ["teacher_edited_text", "belief_statement", "evidence"]
    ),
    relevant_research_summaries: capCategoryWords(
      relevant.researchSummaries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        summary_short: truncateWords(entry.summary_short, 55),
        key_ideas: entry.key_ideas.slice(0, 4),
        suggested_tags: entry.suggested_tags.slice(0, 6)
      })),
      ["title", "summary_short"]
    ),
    relevant_reflection_summaries: capCategoryWords(
      relevant.reflectionSummaries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        summary_short: truncateWords(entry.summary_short, 55),
        key_insight: truncateWords(entry.key_insight, 45),
        themes: entry.themes.slice(0, 6)
      })),
      ["title", "summary_short", "key_insight"]
    ),
    relevant_lesson_idea_summaries: capCategoryWords(
      relevant.lessonIdeaSummaries.map((idea) => ({
        id: idea.id,
        title: idea.title,
        summary_short: truncateWords(idea.summary_short, 55),
        suggested_tags: idea.suggested_tags.slice(0, 6),
        status: idea.status
      })),
      ["title", "summary_short"]
    )
  };
}
