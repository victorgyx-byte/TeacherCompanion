import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_EXTRACTED_CHARS = 20000;

function trimContent(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACTED_CHARS);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const mime = file.type.toLowerCase();
    let extractedText = "";

    if (mime.includes("pdf") || lowerName.endsWith(".pdf")) {
      const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
      const arrayBuffer = await file.arrayBuffer();
      const parsed = await pdfParse(Buffer.from(arrayBuffer));
      extractedText = parsed.text ?? "";
    } else if (mime.includes("text") || lowerName.endsWith(".txt")) {
      extractedText = await file.text();
    } else {
      return NextResponse.json({ error: "Unsupported file type. Upload PDF or TXT." }, { status: 400 });
    }

    const cleaned = trimContent(extractedText);
    if (!cleaned) {
      return NextResponse.json({ error: "Could not extract readable text from this file." }, { status: 400 });
    }

    const titleSuggestion = lowerName.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
    return NextResponse.json({
      title_suggestion: titleSuggestion,
      extracted_text: cleaned
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "File extraction failed." }, { status: 500 });
  }
}
