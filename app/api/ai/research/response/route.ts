import { generateJson, researchResponseSchema } from "@/lib/ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const LIST_SCHEMA = z.union([z.array(z.unknown()), z.string()]).optional();

const FLEXIBLE_RESEARCH_RESPONSE_SCHEMA = z
  .object({
    possible_beliefs: LIST_SCHEMA,
    possibleBeliefs: LIST_SCHEMA,
    beliefs: LIST_SCHEMA,
    key_beliefs: LIST_SCHEMA,
    candidate_beliefs: LIST_SCHEMA,
    tensions: LIST_SCHEMA,
    unresolved_questions: LIST_SCHEMA,
    unresolvedQuestions: LIST_SCHEMA,
    suggested_tags: LIST_SCHEMA,
    suggestedTags: LIST_SCHEMA,
    tags: LIST_SCHEMA,
    reflective_questions: LIST_SCHEMA
  })
  .passthrough();

const FALLBACK_BELIEF_SCHEMA = z.object({
  possible_beliefs: z.array(z.string())
});

const RESEARCH_RESPONSE_PROMPT = `
You are helping a teacher convert their own response into draft belief statements.

Priorities:
1) Beliefs must come mainly from the teacher response, not from the research text alone.
2) Extract concrete beliefs in teacher voice where possible.
3) Surface tensions and unresolved questions honestly.
4) Suggest retrieval tags for future context filtering.

Output quality:
- Keep every list concise and useful.
- Avoid abstract filler.
- Do not invent citations or references.
`;

function objectToBestString(value: Record<string, unknown>): string {
  const priorityKeys = [
    "belief_statement",
    "belief",
    "statement",
    "text",
    "idea",
    "question",
    "tag",
    "title",
    "value"
  ];
  for (const key of priorityKeys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  const firstString = Object.values(value).find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof firstString === "string" ? firstString.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return objectToBestString(item as Record<string, unknown>);
        return "";
      })
      .map((item) => item.trim())
      .filter((item) => item.length > 2)
      .filter((item, index, all) => all.indexOf(item) === index);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|;|•/)
      .map((item) => item.trim())
      .filter((item) => item.length > 2)
      .filter((item, index, all) => all.indexOf(item) === index);
  }

  return [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.teacher_response) {
      return NextResponse.json({ error: "Write your response before creating belief suggestions." }, { status: 400 });
    }
    const raw = await generateJson({
      schema: FLEXIBLE_RESEARCH_RESPONSE_SCHEMA,
      system: RESEARCH_RESPONSE_PROMPT,
      user: {
        teacher_response: body.teacher_response,
        research_summary: body.research_summary ?? "",
        existing_approved_beliefs: body.existing_approved_beliefs ?? []
      },
      model: process.env.OPENAI_SUMMARY_MODEL
    });

    let possibleBeliefs = toStringArray(
      raw.possible_beliefs ??
      raw.possibleBeliefs ??
      raw.beliefs ??
      raw.key_beliefs ??
      raw.candidate_beliefs
    );

    // Fallback pass: if the first response has no usable belief statements, force a tight beliefs-only extraction.
    if (!possibleBeliefs.length) {
      const fallback = await generateJson({
        schema: FALLBACK_BELIEF_SCHEMA,
        system:
          "Extract 3 to 6 draft teacher belief statements from the teacher response only. Return concise first-person beliefs.",
        user: {
          teacher_response: body.teacher_response,
          research_summary: body.research_summary ?? ""
        },
        model: process.env.OPENAI_SUMMARY_MODEL
      });
      possibleBeliefs = toStringArray(fallback.possible_beliefs);
    }

    const result = researchResponseSchema.parse({
      possible_beliefs: possibleBeliefs.slice(0, 6),
      tensions: toStringArray(raw.tensions).slice(0, 6),
      unresolved_questions: toStringArray(raw.unresolved_questions ?? raw.unresolvedQuestions ?? raw.reflective_questions).slice(0, 6),
      suggested_tags: toStringArray(raw.suggested_tags ?? raw.suggestedTags ?? raw.tags).slice(0, 8)
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI response analysis failed." }, { status: 500 });
  }
}
