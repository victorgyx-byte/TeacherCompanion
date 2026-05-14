import { generateJson, philosophyDraftSchema } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const approvedBeliefs = body.approved_beliefs ?? [];
    if (approvedBeliefs.length === 0) {
      return NextResponse.json({ error: "Approve at least one belief card before generating a philosophy draft." }, { status: 400 });
    }
    const result = await generateJson({
      schema: philosophyDraftSchema,
      system:
        "Generate an editable teacher-authored philosophy draft using only approved belief cards and explicitly selected unresolved questions. Never overwrite teacher text.",
      user: {
        approved_beliefs: approvedBeliefs,
        unresolved_questions: body.unresolved_questions ?? [],
        teacher_instruction: body.teacher_instruction ?? ""
      },
      model: process.env.OPENAI_REASONING_MODEL ?? process.env.OPENAI_SUMMARY_MODEL
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI philosophy draft failed." }, { status: 500 });
  }
}
