import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_DB_ENDPOINT!,
  apiKey: process.env.QDRANT_API_KEY!,
});

export async function ensureCollection() {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.find((c) => c.name === "pdf_docs");
//   await qdrant.deleteCollection("pdf_docs").catch(() => {});
  if (!exists) {
    await qdrant.createCollection("pdf_docs", {
      vectors: {
        size: 384,
        distance: "Cosine",
      },
    });
    console.log("✅ pdf_docs collection created");
  }
}
