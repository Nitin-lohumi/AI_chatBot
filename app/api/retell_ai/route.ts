import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = body?.type;
    if (!type || type === "call") {
      const webCall = await retell.call.createWebCall({
        agent_id: process.env.RETELL_AGENT_ID!,
      });

      return NextResponse.json({ access_token: webCall.access_token });
    }

    if (type === "chat") {
      const message: string = body?.message;
      if (!message?.trim()) {
        return NextResponse.json(
          { error: "Message required" },
          { status: 400 },
        );
      }
      const llmRes = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful assistant. Keep answers short and friendly.",
              },
              { role: "user", content: message },
            ],
          }),
        },
      );

      const data = await llmRes.json();
      const reply = data?.choices?.[0]?.message?.content || "No response";
      return NextResponse.json({ text: reply });
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
