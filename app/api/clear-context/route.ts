import { NextRequest, NextResponse } from "next/server";
import { qdrant } from "@/lib/Qdrantdb_config";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }
    await qdrant.delete("pdf_docs", {
      wait: true,
      filter: {
        must: [{ key: "sessionId", match: { value: sessionId } }],
      },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Clear session error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
