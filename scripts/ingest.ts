import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../src/lib/db";
import { embed, toVectorLiteral, EMBEDDING_DIM } from "../src/lib/embeddings";

const CONTENT_DIR = path.join(process.cwd(), "content");
const MAX_CHARS = 700; // target chunk size
const OVERLAP = 120; // characters repeated between chunks to preserve context

interface Chunk {
  source: string;
  title: string;
  index: number;
  content: string;
}

// Split a markdown document into chunks, keeping each "##" section together
// when it fits, and sliding a window with overlap when a section is too long.
function chunkMarkdown(source: string, raw: string): Chunk[] {
  const lines = raw.split("\n");
  const docTitle = lines.find((l) => l.startsWith("# "))?.replace("# ", "").trim() ?? source;

  // Split on level-2 headings; each section keeps its heading as context.
  const sections = raw
    .split(/\n(?=## )/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let index = 0;

  for (const section of sections) {
    const heading =
      section.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? docTitle;

    if (section.length <= MAX_CHARS) {
      chunks.push({ source, title: heading, index: index++, content: section });
      continue;
    }

    // Section too long → sliding window with overlap.
    let start = 0;
    while (start < section.length) {
      const end = Math.min(start + MAX_CHARS, section.length);
      const slice = section.slice(start, end);
      chunks.push({
        source,
        title: heading,
        index: index++,
        // Prefix the heading so an isolated chunk still carries its topic.
        content: start === 0 ? slice : `## ${heading}\n${slice}`,
      });
      if (end === section.length) break;
      start = end - OVERLAP;
    }
  }

  return chunks;
}

async function main() {
  console.log("Preparing schema (pgvector)…");
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
  await pool.query(`DROP TABLE IF EXISTS documents;`);
  await pool.query(`
    CREATE TABLE documents (
      id          SERIAL PRIMARY KEY,
      source      TEXT NOT NULL,
      title       TEXT NOT NULL,
      chunk_index INT  NOT NULL,
      content     TEXT NOT NULL,
      embedding   VECTOR(${EMBEDDING_DIM}) NOT NULL
    );
  `);
  // HNSW index for fast approximate nearest-neighbour search by cosine distance.
  await pool.query(`
    CREATE INDEX documents_embedding_idx
      ON documents USING hnsw (embedding vector_cosine_ops);
  `);

  const files = (await fs.readdir(CONTENT_DIR)).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} documents.`);

  let total = 0;
  for (const file of files) {
    const raw = await fs.readFile(path.join(CONTENT_DIR, file), "utf8");
    const chunks = chunkMarkdown(file, raw);

    for (const chunk of chunks) {
      const vector = await embed(chunk.content, "RETRIEVAL_DOCUMENT");
      await pool.query(
        `INSERT INTO documents (source, title, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [chunk.source, chunk.title, chunk.index, chunk.content, toVectorLiteral(vector)]
      );
      total++;
    }
    console.log(`  ${file} → ${chunks.length} chunks`);
  }

  console.log(`\nIngest complete: ${total} chunks embedded and stored.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
