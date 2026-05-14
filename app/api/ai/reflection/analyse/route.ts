import { generateJson, reflectionAnalysisSchema } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.raw_reflection) {
      return NextResponse.json({ error: "Write a reflection before asking AI to analyse it." }, { status: 400 });
    }
    const result = await generateJson({
      schema: reflectionAnalysisSchema,
      system:
        "You analyse teacher reflections for themes, tensions, next actions, and possible belief suggestions. Keep suggestions editable and tentative.",
      user: {
        raw_reflection: body.raw_reflection,
        compact_context_pack: body.compact_context_pack
      },
      model: process.env.OPENAI_SUMMARY_MODEL
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI reflection analysis failed." }, { status: 500 });
  }
}
