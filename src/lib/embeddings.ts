// Embeddings via Google's gemini-embedding-001 — a hosted, multilingual model on
// the free tier. Being a plain HTTPS call (no native binaries), it runs anywhere
// the app does, including Vercel's serverless runtime, which the previous local
// ONNX model could not.

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIM = 768; // the model's full size is 3072; 768 is plenty here

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

// gemini-embedding-001 is asymmetric: documents and queries are embedded with
// different task types so a question lands near the passages that answer it.
export type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

// Reduced-dimension outputs (< 3072) are returned un-normalized, so we L2-
// normalize here — that turns cosine similarity into a plain dot product and
// keeps distances comparable across vectors.
function normalize(v: number[]): number[] {
  const norm = Math.hypot(...v);
  return norm === 0 ? v : v.map((x) => x / norm);
}

export async function embed(
  text: string,
  taskType: TaskType = "RETRIEVAL_QUERY"
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIM,
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini embeddings ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values?.length) throw new Error("Gemini devolvió un embedding vacío");
  return normalize(values);
}

// pgvector accepts a vector literal like '[0.1,0.2,...]'.
export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;
