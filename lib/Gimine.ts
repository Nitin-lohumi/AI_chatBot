import { ChatGroq } from "@langchain/groq";

export const model = new ChatGroq({
  model: "llama-3.3-70b-versatile", 
  apiKey: process.env.GROQ_API_KEY!,
  temperature: 0.7,
});