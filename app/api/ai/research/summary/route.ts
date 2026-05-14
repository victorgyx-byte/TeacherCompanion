import { generateJson, researchSummarySchema } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title || !body.raw_content) {
      return NextResponse.json({ error: "Add a title and research notes before asking AI to summarise." }, { status: 400 });
    }
    const result = await generateJson({
      schema: researchSummarySchema,
      system:
        "You help teachers summarise research notes for later reflective use. Summarise once so future AI calls can use this compact memory instead of raw content.",
      user: {
        title: body.title,
        raw_content: body.raw_content,
        teacher_note: body.teacher_note ?? ""
      },
      model: process.env.OPENAI_SUMMARY_MODEL
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI summary failed." }, { status: 500 });
  }
}
