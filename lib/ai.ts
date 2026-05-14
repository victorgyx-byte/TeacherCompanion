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

function extractStringFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  const directKeys = ["text", "content", "value", "arguments", "output_text", "message"];
  for (const key of directKeys) {
    const candidate = record[key];
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = extractStringFromUnknown(candidate);
      if (nested) return nested;
    }
  }

  for (const candidate of Object.values(record)) {
    const nested = extractStringFromUnknown(candidate);
    if (nested) return nested;
  }

  return "";
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        const extracted = extractStringFromUnknown(part);
        return extracted.trim();
      })
      .filter(Boolean);
    return parts.join("\n");
  }

  return extractStringFromUnknown(content);
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new AiError("AI returned empty text content.");

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with recovery strategies below.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // Continue with recovery strategies below.
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    const candidate = trimmed.slice(objectStart, objectEnd + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue with recovery strategies below.
    }
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const candidate = trimmed.slice(arrayStart, arrayEnd + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue to final error below.
    }
  }

  const preview = trimmed.slice(0, 180).replace(/\s+/g, " ");
  throw new AiError(`AI returned unparsable JSON content. Preview: ${preview}`);
}

function describeValueShape(value: unknown): string {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value === null) return "null";
  if (typeof value === "object") return `object(${Object.keys(value as Record<string, unknown>).join(",")})`;
  return typeof value;
}

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
  const contentText = extractMessageText(content);
  if (!contentText) {
    throw new AiError(`AI returned no readable text content (shape: ${describeValueShape(content)}).`);
  }

  try {
    const parsed = parseJsonContent(contentText);
    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      const firstIssue = validated.error.issues[0];
      throw new AiError(`AI JSON schema mismatch at "${firstIssue.path.join(".") || "root"}": ${firstIssue.message}`);
    }
    return validated.data;
  } catch (error) {
    if (error instanceof AiError) throw error;
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
