// pages/api/clear-context.ts
import { NextRequest, NextResponse } from "next/server";
import { qdrant } from "@/lib/Qdrantdb_config";

export async function POST(req: NextRequest) {
  try {
    await qdrant.delete("pdf_docs", { filter: {} });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
