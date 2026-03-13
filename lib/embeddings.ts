const HF_API_URL =
  "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction";
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN!;

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vec : vec.map((v) => v / norm);
}

async function embedText(text: string): Promise<number[]> {
  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text,
      options: { wait_for_model: true },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace embedding error: ${err}`);
  }

  const data = await res.json();

  let vector: number[];

  if (typeof data[0] === "number") {
    vector = data as number[];
  } else if (Array.isArray(data[0])) {
    const tokenVecs = data as number[][];
    const dim = tokenVecs[0].length;
    const mean = new Array(dim).fill(0);
    for (const vec of tokenVecs) {
      for (let i = 0; i < dim; i++) mean[i] += vec[i];
    }
    vector = mean.map((v) => v / tokenVecs.length);
  } else {
    throw new Error(`Unknown HF response shape`);
  }

  return normalize(vector);
}

export const embeddings = {
  embedQuery: (text: string) => embedText(text),
  embedDocuments: (texts: string[]) => Promise.all(texts.map(embedText)),
};