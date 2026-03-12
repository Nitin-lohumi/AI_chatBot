import { embeddings } from "./embeddings";
import { qdrant } from "./Qdrantdb_config";

export async function searchDocs(query: string) {
  const vector = await embeddings.embedQuery(query);

  const result = await qdrant.search("pdf_docs", {
    vector,
    limit: 3,
  });

  return result;
}
