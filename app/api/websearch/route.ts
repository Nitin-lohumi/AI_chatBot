import { NextRequest, NextResponse } from "next/server";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { model } from "@/lib/Gimine";
import { tavily } from "@tavily/core";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });

async function tavilySearch(query: string): Promise<{
  context: string;
  sources: { title: string; url: string }[];
}> {
  const response = await client.search(query, {
    includeAnswer: "basic",
    searchDepth: "advanced",
    maxResults:   5,
  });

  const sources = (response.results || []).map((r: any) => ({
    title: r.title,
    url:   r.url,
  }));

  const results = (response.results || [])
    .map((r: any, i: number) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
    .join("\n\n");

  const context = response.answer
    ? `Summary: ${response.answer}\n\nDetailed Results:\n${results}`
    : results;

  return { context, sources };
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const { context: searchResults, sources } = await tavilySearch(message);

    const systemPrompt = `You are a helpful AI assistant with web search capability.

WEB SEARCH RESULTS for "${message}":
${searchResults}

RULES:
- Answer based on the search results above
- Cite sources where relevant
- If results are insufficient, say so clearly
- Format response in clear markdown
- Reply in the same language as the user`;

    const pastMessages: BaseMessage[] = history.flatMap(
      (h: { role: string; text: string }) =>
        h.role === "user" ? [new HumanMessage(h.text)] : [new AIMessage(h.text)]
    );

    const invokeMessages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...pastMessages,
      new HumanMessage(message),
    ];

    const stream  = await model.stream(invokeMessages);
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            "data: " + JSON.stringify({ webSearch: true, sources }) + "\n\n"
          )
        );

        for await (const chunk of stream) {
          const text = chunk.content as string;
          if (text) {
            controller.enqueue(
              encoder.encode("data: " + JSON.stringify({ token: text }) + "\n\n")
            );
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection:      "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Web search error:", err);
    return NextResponse.json(
      { error: err.message || "Web search failed" },
      { status: 500 }
    );
  }
}