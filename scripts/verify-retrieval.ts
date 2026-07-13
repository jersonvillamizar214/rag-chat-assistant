import "dotenv/config";
import { retrieve, MIN_SIMILARITY } from "../src/lib/retrieve";
import { pool } from "../src/lib/db";

// Checks the retrieval half of the RAG pipeline: a question phrased in natural
// language must surface the document that actually contains the answer.
// No LLM and no API key needed — so this runs on every CI build.
const CASES = [
  {
    question: "¿Cuántos días tengo para devolver un producto?",
    expect: "devoluciones-y-garantia.md",
  },
  {
    question: "¿Cuánto cuesta el envío express?",
    expect: "envios-y-entregas.md",
  },
  {
    question: "¿Puedo pagar contra entrega?",
    expect: "metodos-de-pago.md",
  },
  {
    question: "¿En qué año se fundó la empresa?",
    expect: "sobre-copower.md",
  },
];

async function main() {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM documents"
  );
  const stored = Number(rows[0].count);
  if (stored === 0) throw new Error("No chunks stored — run the ingest first.");
  console.log(`${stored} chunks in the vector store.\n`);

  let failures = 0;

  for (const testCase of CASES) {
    const results = await retrieve(testCase.question, 3);
    const sources = results.map((r) => r.source);
    const top = results[0];

    const found = sources.includes(testCase.expect);
    const relevant = top && top.similarity >= MIN_SIMILARITY;

    if (found && relevant) {
      console.log(
        `  ok  "${testCase.question}" → ${testCase.expect} (${(top.similarity * 100).toFixed(0)}%)`
      );
    } else {
      failures++;
      console.error(
        `  FAIL "${testCase.question}" → expected ${testCase.expect}, got [${sources.join(", ")}]`
      );
    }
  }

  await pool.end();

  if (failures > 0) {
    throw new Error(`${failures} retrieval case(s) failed.`);
  }
  console.log("\nSemantic retrieval verified.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
