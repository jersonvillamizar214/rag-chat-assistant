import type { FeatureExtractionPipeline } from "@xenova/transformers";

// all-MiniLM-L6-v2 → 384-dimensional sentence embeddings.
// Runs locally in Node (ONNX), so no embeddings API key or cost.
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIM = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

// Imported dynamically and only once: loading the native ONNX runtime at module
// scope would run during `next build` (and fail there), even though it's only
// ever needed to serve a request.
function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= import("@xenova/transformers").then(({ pipeline }) =>
    pipeline("feature-extraction", EMBEDDING_MODEL)
  );
  return extractorPromise;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  // Mean pooling + L2 normalize → cosine similarity becomes a dot product.
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

// pgvector accepts a vector literal like '[0.1,0.2,...]'.
export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;
