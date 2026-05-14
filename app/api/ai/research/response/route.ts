import { generateJson, researchResponseSchema } from "@/lib/ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const FLEXIBLE_RESEARCH_RESPONSE_SCHEMA = z
  .object({
    possible_beliefs: z.union([z.array(z.string()), z.string()]).optional(),
    tensions: z.union([z.array(z.string()), z.string()]).optional(),
    unresolved_questions: z.union([z.array(z.string()), z.string()]).optional(),
    suggested_tags: z.union([z.array(z.string()), z.string()]).optional(),
    beliefs: z.union([z.array(z.string()), z.string()]).optional(),
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    reflective_questions: z.union([z.array(z.string()), z.string()]).optional()
  })
  .passthrough();

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

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : ""))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|;|•|-/)
      .map((item) => item.trim())
      .filter(Boolean);
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

    const result = researchResponseSchema.parse({
      possible_beliefs: toStringArray(raw.possible_beliefs ?? raw.beliefs),
      tensions: toStringArray(raw.tensions),
      unresolved_questions: toStringArray(raw.unresolved_questions ?? raw.reflective_questions),
      suggested_tags: toStringArray(raw.suggested_tags ?? raw.tags)
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI response analysis failed." }, { status: 500 });
  }
}
