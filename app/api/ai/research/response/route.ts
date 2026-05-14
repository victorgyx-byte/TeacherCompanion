import { generateJson, researchResponseSchema } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.teacher_response) {
      return NextResponse.json({ error: "Write your response before creating belief suggestions." }, { status: 400 });
    }
    const result = await generateJson({
      schema: researchResponseSchema,
      system:
        "You analyse a teacher's own response to research. Possible philosophy beliefs must come primarily from the teacher response, not the raw research.",
      user: {
        teacher_response: body.teacher_response,
        research_summary: body.research_summary ?? "",
        existing_approved_beliefs: body.existing_approved_beliefs ?? []
      },
      model: process.env.OPENAI_SUMMARY_MODEL
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI response analysis failed." }, { status: 500 });
  }
}
