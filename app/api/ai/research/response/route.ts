import { generateJson, researchResponseSchema } from "@/lib/ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const ANY_JSON_SCHEMA = z.any();

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

function normalizeSentence(text: string): string {
  return text
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toBeliefDraft(text: string): string {
  const normalized = normalizeSentence(text).replace(/[.?!]+$/, "");
  if (!normalized) return "";
  if (/^i\s/i.test(normalized)) return `${normalized}.`;
  if (/^my\s/i.test(normalized)) return `I believe ${normalized}.`;
  return `I believe ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}.`;
}

function heuristicBeliefsFromResponse(teacherResponse: string): string[] {
  const segments = teacherResponse
    .split(/\n|(?<=[.!?])\s+/)
    .map(normalizeSentence)
    .filter((item) => item.length >= 28 && item.length <= 240);

  const drafts = segments
    .map(toBeliefDraft)
    .filter((item) => item.length > 8)
    .filter((item, index, all) => all.indexOf(item) === index);

  return drafts.slice(0, 6);
}

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
    let raw: Record<string, unknown> = {};
    let aiPrimarySucceeded = false;
    let fallbackUsed = false;
    let fallbackMode = "none";
    let fallbackReason = "";
    try {
      const rawJson = await generateJson({
        schema: ANY_JSON_SCHEMA,
        system: RESEARCH_RESPONSE_PROMPT,
        user: {
          teacher_response: body.teacher_response,
          research_summary: body.research_summary ?? "",
          existing_approved_beliefs: body.existing_approved_beliefs ?? []
        },
        model: process.env.OPENAI_SUMMARY_MODEL
      });
      raw = rawJson && typeof rawJson === "object" ? (rawJson as Record<string, unknown>) : {};
      aiPrimarySucceeded = true;
    } catch (error) {
      // Graceful fallback: preserve flow even when AI JSON is malformed once.
      raw = {
        possible_beliefs: heuristicBeliefsFromResponse(body.teacher_response),
        tensions: [],
        unresolved_questions: [],
        suggested_tags: []
      };
      fallbackUsed = true;
      fallbackMode = "primary_error_heuristic";
      fallbackReason = error instanceof Error ? error.message : "Primary AI parse failed.";
    }

    let possibleBeliefs = toStringArray(
      raw.possible_beliefs ??
      raw.possibleBeliefs ??
      raw.beliefs ??
      raw.key_beliefs ??
      raw.candidate_beliefs
    );

    // Fallback pass: if the first response has no usable belief statements, force a tight beliefs-only extraction.
    if (!possibleBeliefs.length && aiPrimarySucceeded) {
      fallbackUsed = true;
      fallbackMode = "secondary_belief_pass";
      fallbackReason = "Primary output had no usable belief list.";
      try {
        const fallbackRaw = await generateJson({
          schema: ANY_JSON_SCHEMA,
          system:
            "Extract 3 to 6 draft teacher belief statements from the teacher response only. Return concise first-person beliefs.",
          user: {
            teacher_response: body.teacher_response,
            research_summary: body.research_summary ?? ""
          },
          model: process.env.OPENAI_SUMMARY_MODEL
        });
        const fallback = FALLBACK_BELIEF_SCHEMA.safeParse(fallbackRaw);
        if (fallback.success) {
          possibleBeliefs = toStringArray(fallback.data.possible_beliefs);
        } else {
          const fallbackObject = fallbackRaw && typeof fallbackRaw === "object" ? (fallbackRaw as Record<string, unknown>) : {};
          possibleBeliefs = toStringArray(
            fallbackObject.possible_beliefs ??
            fallbackObject.possibleBeliefs ??
            fallbackObject.beliefs ??
            fallbackObject.key_beliefs ??
            fallbackObject.candidate_beliefs
          );
        }
      } catch (error) {
        fallbackMode = "secondary_error_heuristic";
        fallbackReason = error instanceof Error ? error.message : "Secondary AI belief extraction failed.";
      }
    }

    if (!possibleBeliefs.length) {
      if (!fallbackUsed) {
        fallbackUsed = true;
        fallbackMode = "final_heuristic";
        fallbackReason = "AI output did not provide beliefs. Heuristic extraction used.";
      }
      possibleBeliefs = heuristicBeliefsFromResponse(body.teacher_response);
    }

    const result = researchResponseSchema.parse({
      possible_beliefs: possibleBeliefs.slice(0, 6),
      tensions: toStringArray(raw.tensions).slice(0, 6),
      unresolved_questions: toStringArray(raw.unresolved_questions ?? raw.unresolvedQuestions ?? raw.reflective_questions).slice(0, 6),
      suggested_tags: toStringArray(raw.suggested_tags ?? raw.suggestedTags ?? raw.tags).slice(0, 8)
    });

    return NextResponse.json({
      ...result,
      generation_meta: {
        fallback_used: fallbackUsed,
        fallback_mode: fallbackMode,
        fallback_reason: fallbackReason
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI response analysis failed." }, { status: 500 });
  }
}
