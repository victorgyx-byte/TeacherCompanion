import { generateJson, researchSummarySchema } from "@/lib/ai";
import { NextResponse } from "next/server";

const RESEARCH_SUMMARY_PROMPT = `
You are a reflective research companion for teachers.

Your job is to read the teacher's research notes/excerpts carefully and extract the strongest ideas with precision.

Focus on substance, not generic phrasing:
1) Identify the core claim(s), argument, or model in the notes.
2) Pull out the most important ideas the teacher could actually use in practice.
3) Translate ideas into concrete teaching implications.
4) Suggest focused tags for later retrieval.
5) Write reflective questions that surface tensions, trade-offs, or next experimentation steps.

Quality rules:
- Stay grounded in the provided text only.
- Do not invent quotes, citations, authors, or references.
- If the notes are fragmented, still produce a best-effort output and avoid vague filler.
- Keep wording concrete, concise, and teacher-useful.

Output targets:
- summary_short: 70-130 words, plain language, one coherent paragraph.
- key_ideas: 3-5 bullets.
- teaching_implications: 3-5 action-oriented bullets.
- suggested_tags: 4-8 concise lower-case phrases.
- reflective_questions: 3-5 open-ended questions.
`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title || !body.raw_content) {
      return NextResponse.json({ error: "Add a title and research notes before asking AI to summarise." }, { status: 400 });
    }
    const result = await generateJson({
      schema: researchSummarySchema,
      system: RESEARCH_SUMMARY_PROMPT,
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
