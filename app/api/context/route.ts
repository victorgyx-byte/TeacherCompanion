import { buildCompactContextPack } from "@/lib/retrieval";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pack = buildCompactContextPack(body.data, body.taskType, body.inputText ?? "", body.tags ?? []);
    return NextResponse.json(pack);
  } catch {
    return NextResponse.json({ error: "Could not build compact context." }, { status: 500 });
  }
}
