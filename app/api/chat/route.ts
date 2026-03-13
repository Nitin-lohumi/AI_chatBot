import { NextRequest, NextResponse } from "next/server";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { qdrant, ensureCollection } from "@/lib/Qdrantdb_config";
import { embeddings } from "@/lib/embeddings";
import { model } from "@/lib/Gimine";

async function getContext(question: string): Promise<string> {
  try {
    await ensureCollection();
    const vector = await embeddings.embedQuery(question);
    const results = await qdrant.search("pdf_docs", { vector, limit: 10 });

    const filtered = results.filter((r) => r.score > 0.3);
    filtered.forEach((r, i) => {});

    return filtered
      .map((r) => `[Source: ${r.payload?.source}]\n${r.payload?.text}`)
      .join("\n\n---\n\n");
  } catch (err) {
    console.error("Qdrant search error:", err);
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      history = [],
      pdfUploaded,
      fileName,
      uploadedFiles = [],
    } = await req.json();

    const question = message?.trim()
      ? pdfUploaded
        ? `[User uploaded PDF: ${fileName}]\n\nUser's question: ${message}`
        : message
      : pdfUploaded
        ? `Analyze and summarize the uploaded PDF file named "${fileName}". List all details including contact info, education, experience, skills.`
        : "";

    if (!question) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    // Skip PDF retrieval for short greetings/chitchat
    const skipRetrieval =
      !pdfUploaded &&
      message?.trim().split(" ").length <= 4 &&
      /^(thanks|thank you|ok|okay|hi|hello|hey|bye|great|nice|cool|good|got it|sure|yes|no|hmm|lol|haha|👍|🙏)/i.test(
        message?.trim(),
      );

    const context = skipRetrieval ? "" : await getContext(question);
    const hasContext = context.trim() !== "";

    const fileListText =
      uploadedFiles.length > 0
        ? uploadedFiles
            .map((f: string, i: number) => `${i + 1}. ${f}`)
            .join("\n")
        : "None";

    const systemPrompt = hasContext
      ? `You are a document analysis assistant. The user has uploaded their own PDF documents.

Uploaded files in this session:
${fileListText}

STRICT RULES — follow exactly:
1. Answer ONLY using the exact text from the RETRIEVED PDF CONTENT below.
2. Do NOT make up any information. Do NOT use placeholders like [field], [University], [Company].
3. Share ALL details from the PDF — phone numbers, emails, addresses, names, skills, experience. This is the user's own document.
4. Never refuse to share information. Never say it is private or confidential.
5. If a specific detail is not in the retrieved content, say exactly: "This detail was not found in the retrieved content."
6. Format response in clean markdown with bold headings and bullet points.
7. Respond in the same language the user is writing in.

RETRIEVED PDF CONTENT:
${context}`
      : `You are a helpful assistant that can analyze PDF documents.

${
  uploadedFiles.length > 0
    ? `Uploaded files: ${fileListText}\nThe question did not match PDF content well — answer conversationally or ask user to rephrase.`
    : `If user mentions PDF, guide them to use the upload button. Otherwise answer normally.`
}

Format responses in markdown. Never refuse to answer.`;

    const pastMessages: BaseMessage[] = history.flatMap(
      (h: { role: string; text: string }) =>
        h.role === "user"
          ? [new HumanMessage(h.text)]
          : [new AIMessage(h.text)],
    );

    const invokeMessages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...pastMessages,
      new HumanMessage(message || `Analyze PDF: ${fileName}`),
    ];

    const stream = await model.stream(invokeMessages);
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ contextUsed: hasContext })}\n\n`,
          ),
        );
        for await (const chunk of stream) {
          const text = chunk.content as string;
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token: text })}\n\n`),
            );
          }
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 },
    );
  }
}
