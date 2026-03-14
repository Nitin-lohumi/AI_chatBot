import { NextRequest, NextResponse } from "next/server";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { qdrant, ensureCollection } from "@/lib/Qdrantdb_config";
import { embeddings } from "@/lib/embeddings";
import { model } from "@/lib/Gimine";

const GraphState = Annotation.Root({
  question: Annotation<string>({ reducer: (_, y) => y, default: () => "" }),
  sessionId: Annotation<string>({ reducer: (_, y) => y, default: () => "" }),
  uploadedFiles: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  history: Annotation<{ role: string; text: string }[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  currentFile: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  isSimple: Annotation<boolean>({ reducer: (_, y) => y, default: () => false }),
  context: Annotation<string>({ reducer: (_, y) => y, default: () => "" }),
  systemPrompt: Annotation<string>({ reducer: (_, y) => y, default: () => "" }),
});

async function routeNode(state: typeof GraphState.State) {
  const isSimple =
    state.uploadedFiles.length === 0 &&
    !state.currentFile &&
    /^(hi|hello|hey|thanks|thank you|ok|okay|bye|yes|no|hmm|cool|great|nice|sure)[\s!.?]*$/i.test(
      state.question.trim(),
    );
  return { isSimple };
}

async function retrieveNode(state: typeof GraphState.State) {
  if (state.isSimple) return { context: "" };

  try {
    await ensureCollection();
    const vector = await embeddings.embedQuery(state.question);
    const filter = state.currentFile
      ? {
          must: [
            { key: "sessionId", match: { value: state.sessionId } },
            { key: "source", match: { value: state.currentFile } },
          ],
        }
      : {
          must: [{ key: "sessionId", match: { value: state.sessionId } }],
        };

    const results = await qdrant.search("pdf_docs", {
      vector,
      limit: 20,
      filter,
    });

    const filtered = results.filter((r) => r.score > 0.05);
    if (!filtered.length) return { context: "" };

    return {
      context: filtered
        .map((r) => `[PDF: ${r.payload?.source}]\n${r.payload?.text as string}`)
        .join("\n\n---\n\n"),
    };
  } catch (err) {
    console.error("Qdrant search error:", err);
    return { context: "" };
  }
}

async function promptNode(state: typeof GraphState.State) {
  const hasContext = state.context.trim() !== "";
  const fileListText =
    state.uploadedFiles.length > 0 ? state.uploadedFiles.join(", ") : "None";

  const systemPrompt = hasContext
    ? `You are a helpful document assistant. PDFs uploaded in this session: ${fileListText}

RETRIEVED CONTENT:
${state.context}

RULES:
- Answer using ONLY the retrieved content above
- [PDF: filename] tag se pata chalega kaunsi PDF se answer aa raha hai
- Multiple PDFs mein se jo relevant ho usi se answer do
- Give complete, detailed answers
- If something is not found in content, say so clearly
- Format clearly with markdown
- Reply in the same language as the user`
    : state.uploadedFiles.length > 0
      ? `You are a helpful document assistant. The user has uploaded: ${fileListText}.
No relevant content found for this specific question.
Answer helpfully or suggest the user ask more specifically about the PDF.`
      : `You are a helpful AI assistant with PDF reading capability.
The user can upload PDFs using the upload button and you will read and answer questions from them.
NEVER say you cannot read PDFs or access files.
If user asks about PDF capability, tell them to upload using the button below.
For general questions, answer helpfully and concisely.
Reply in the same language as the user.`;

  return { systemPrompt };
}

const workflow = new StateGraph(GraphState)
  .addNode("route", routeNode)
  .addNode("retrieve", retrieveNode)
  .addNode("prompt", promptNode)
  .addEdge(START, "route")
  .addEdge("route", "retrieve")
  .addEdge("retrieve", "prompt")
  .addEdge("prompt", END);

const app = workflow.compile();

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      history = [],
      sessionId,
      uploadedFiles = [],
      currentFile = null,
    } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const result = await app.invoke({
      question: message,
      sessionId,
      uploadedFiles,
      history,
      currentFile,
      isSimple: false,
      context: "",
      systemPrompt: "",
    });

    const hasContext = result.context.trim() !== "";

    const pastMessages: BaseMessage[] = history.flatMap(
      (h: { role: string; text: string }) =>
        h.role === "user"
          ? [new HumanMessage(h.text)]
          : [new AIMessage(h.text)],
    );

    const invokeMessages: BaseMessage[] = [
      new SystemMessage(result.systemPrompt),
      ...pastMessages,
      new HumanMessage(message),
    ];

    const stream = await model.stream(invokeMessages);
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            "data: " + JSON.stringify({ contextUsed: hasContext }) + "\n\n",
          ),
        );
        for await (const chunk of stream) {
          const text = chunk.content as string;
          if (text) {
            controller.enqueue(
              encoder.encode(
                "data: " + JSON.stringify({ token: text }) + "\n\n",
              ),
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
