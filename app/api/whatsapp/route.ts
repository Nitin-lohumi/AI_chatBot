import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { model } from "@/lib/Gimine";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

const history = new Map<string, Array<{ role: string; text: string }>>();

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const from = form.get("From") as string;
    const body = (form.get("Body") as string)?.trim();

    if (!body || !from) return new NextResponse("OK", { status: 200 });

    console.log(`📱 ${from}: ${body}`);

    if (!history.has(from)) history.set(from, []);
    const userHistory = history.get(from)!;

    const historyText = userHistory
      .slice(-6)
      .map((h) => `${h.role === "user" ? "User" : "AI"}: ${h.text}`)
      .join("\n");

    const prompt = `You are a helpful friendly AI assistant on WhatsApp. Keep responses short and clear. Reply in the same language as the user.

Conversation history:
${historyText}

User: ${body}
AI:`;

    const response = await model.invoke(prompt);
    const answer = response.content as string;

    userHistory.push({ role: "user", text: body });
    userHistory.push({ role: "ai", text: answer });
    if (userHistory.length > 20) userHistory.splice(0, userHistory.length - 20);

    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: from,
      body: answer,
    });

    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    console.error("WhatsApp error:", err);
    return new NextResponse(null, { status: 200 });
  }
}
