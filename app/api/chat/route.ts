import { NextRequest, NextResponse } from "next/server";
import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { qdrant, ensureCollection } from "@/lib/Qdrantdb_config";
import { embeddings } from "@/lib/embeddings";
import { model } from "@/lib/Gimine";

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  context: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  question: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
});

async function retrieveContext(state: typeof GraphState.State) {
  const question = state.question;
  try {
    await ensureCollection();
    const vector = await embeddings.embedQuery(question);
    const results = await qdrant.search("pdf_docs", {
      vector,
      limit: 4,
    });
    console.log(
      "🔍 Scores:",
      results.map((r) => r.score),
    );
  
    const context = results
      .filter((r) => r.score > 0.1)
      .map((r) => r.payload?.text as string)
      .join("\n\n");

    return {
      context: context || "",
    };
  } catch (err) {
    console.error("Qdrant search error:", err);
    return { context: "" };
  }
}

async function generateAnswer(state: typeof GraphState.State) {
  const { question, context, messages } = state;
  const historyText = messages
    .slice(-6)
    .map((m) =>
      m instanceof HumanMessage ? `User: ${m.content}` : `AI: ${m.content}`,
    )
    .join("\n");

 
  const hasContext = context && context.trim() !== ""; 

  const prompt = hasContext
    ? `You are a helpful AI assistant. Answer based ONLY on the provided context.

Context from uploaded PDFs:
${context}

Conversation History:
${historyText}

Current Question: ${question}

Answer in detail using the context.`

    : `You are a helpful AI assistant. Answer conversationally.

Conversation History:
${historyText}

Question: ${question}`;

  const response = await model.invoke(prompt);
  return {
    messages: [new AIMessage(response.content as string)],
  };
}


const workflow = new StateGraph(GraphState)
  .addNode("retrieve", retrieveContext)
  .addNode("generate", generateAnswer)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END);

const app = workflow.compile();

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    const pastMessages: BaseMessage[] = history.flatMap(
      (h: { role: string; text: string }) =>
        h.role === "user"
          ? [new HumanMessage(h.text)]
          : [new AIMessage(h.text)],
    );

    const result = await app.invoke({
      question: message,
      messages: [...pastMessages, new HumanMessage(message)],
      context: "",
    });

    const lastMessage = result.messages[result.messages.length - 1];

    return NextResponse.json({
      answer: lastMessage.content,
      contextUsed: result.context !== "",
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 },
    );
  }
}
