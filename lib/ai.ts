import { z } from "zod";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

type JsonSchema<T extends z.ZodTypeAny> = {
  schema: T;
  system: string;
  user: unknown;
  model?: string;
};

export async function generateJson<T extends z.ZodTypeAny>({ schema, system, user, model }: JsonSchema<T>): Promise<z.infer<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiError("OpenAI API key is not configured.");

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model ?? process.env.OPENAI_SUMMARY_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `${system}\nReturn valid JSON only. Do not invent citations or source links. Preserve user-provided references only.`
        },
        { role: "user", content: JSON.stringify(user) }
      ]
    })
  });

  if (!response.ok) {
    throw new AiError(`AI request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new AiError("AI returned an empty response.");

  try {
    return schema.parse(JSON.parse(content));
  } catch {
    throw new AiError("AI returned JSON in an unexpected shape.");
  }
}

export const researchSummarySchema = z.object({
  summary_short: z.string(),
  key_ideas: z.array(z.string()),
  teaching_implications: z.array(z.string()),
  suggested_tags: z.array(z.string()),
  reflective_questions: z.array(z.string())
});

export const researchResponseSchema = z.object({
  possible_beliefs: z.array(z.string()),
  tensions: z.array(z.string()),
  unresolved_questions: z.array(z.string()),
  suggested_tags: z.array(z.string())
});

export const lessonExpansionSchema = z.object({
  clearer_title: z.string(),
  summary: z.string(),
  suggested_tags: z.array(z.string()),
  activity_15_min: z.string(),
  student_instructions: z.string(),
  teacher_facilitation_notes: z.array(z.string()),
  possible_assessment_evidence: z.array(z.string()),
  philosophy_connections: z.array(z.string())
});

export const reflectionAnalysisSchema = z.object({
  key_insight: z.string(),
  themes: z.array(z.string()),
  tensions: z.array(z.string()),
  possible_next_actions: z.array(z.string()),
  possible_beliefs: z.array(z.string()),
  unresolved_questions: z.array(z.string())
});

export const philosophyDraftSchema = z.object({
  philosophy_statement: z.string(),
  sections: z.object({
    what_i_believe: z.array(z.string()),
    what_i_am_testing: z.array(z.string()),
    what_i_am_struggling_with: z.array(z.string()),
    what_shaped_this_belief: z.array(z.string()),
    what_i_want_to_improve: z.array(z.string())
  })
});
