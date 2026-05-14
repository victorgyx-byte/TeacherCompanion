import { generateJson, lessonExpansionSchema } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.raw_lesson_idea) {
      return NextResponse.json({ error: "Add a lesson idea before asking AI to expand it." }, { status: 400 });
    }
    const result = await generateJson({
      schema: lessonExpansionSchema,
      system:
        "You help teachers expand lesson sparks. Use only the compact context pack provided, prioritising approved beliefs. Do not ask for or infer the full archive.",
      user: {
        raw_lesson_idea: body.raw_lesson_idea,
        compact_context_pack: body.compact_context_pack
      },
      model: process.env.OPENAI_SUMMARY_MODEL
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI lesson expansion failed." }, { status: 500 });
  }
}
