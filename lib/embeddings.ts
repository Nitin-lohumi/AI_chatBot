import { pipeline } from "@xenova/transformers";
let embedder: any = null;
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}

async function embedText(text: string): Promise<number[]> {
  const extractor = await getEmbedder();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data) as number[];
}

export const embeddings = {
  embedQuery: (text: string) => embedText(text),
  embedDocuments: (texts: string[]) => Promise.all(texts.map(embedText)),
};
