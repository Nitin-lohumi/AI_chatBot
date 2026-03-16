import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_DB_ENDPOINT!,
  apiKey: process.env.QDRANT_API_KEY!,
});

export async function ensureCollection() {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.find((c) => c.name === "pdf_docs");

  if (!exists) {
    await qdrant.createCollection("pdf_docs", {
      vectors: { size: 384, distance: "Cosine" },
    });
    await qdrant.createPayloadIndex("pdf_docs", {
      field_name: "sessionId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex("pdf_docs", {
      field_name: "source",
      field_schema: "keyword",
    });
  }
}
