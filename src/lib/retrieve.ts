import { pool } from "./db";
import { embed, toVectorLiteral } from "./embeddings";

export interface RetrievedChunk {
  id: number;
  source: string;
  title: string;
  content: string;
  similarity: number;
}

// Semantic search: embed the question, then find the nearest chunks by cosine
// distance (`<=>`). The HNSW index makes this fast as the corpus grows.
export async function retrieve(query: string, k = 4): Promise<RetrievedChunk[]> {
  const vector = toVectorLiteral(await embed(query));

  const { rows } = await pool.query<RetrievedChunk>(
    `SELECT id,
            source,
            title,
            content,
            1 - (embedding <=> $1::vector) AS similarity
     FROM documents
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vector, k]
  );

  return rows;
}

// Only chunks that are actually relevant are worth putting in the prompt.
// Below this cosine similarity the match is usually noise.
export const MIN_SIMILARITY = 0.25;
