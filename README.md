# Chat empresarial con RAG

[![CI](https://github.com/jersonvillamizar214/rag-chat-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/jersonvillamizar214/rag-chat-assistant/actions/workflows/ci.yml)

An enterprise assistant that answers **only** from the company's own documentation. It performs real **semantic search** over a vector store and grounds the LLM's answer in the retrieved passages — every reply shows the sources it used, and it refuses to answer when the information isn't there.

> Part of my developer portfolio. Runs entirely on free tiers: Google's embeddings, Groq's LLM, and PostgreSQL with pgvector.

## Why this is real RAG (and not a chatbot with a prompt)

| Guarantee | How |
| --- | --- |
| **No hallucinations** | The system prompt forbids answering outside the retrieved context. Asked something absent from the docs, it replies *"No tengo esa información en la documentación de Northwind."* |
| **Verifiable** | Every answer ships the retrieved chunks with their cosine-similarity scores, shown in the UI. |
| **Semantic, not keyword** | Questions are embedded into 384-d vectors and matched by cosine distance in `pgvector` — a question phrased differently still finds the right passage. |

## The pipeline

```
Pregunta
   │
   ▼
[1 · RETRIEVE]  Gemini embeds the question (768-d)
   │            → pgvector: ORDER BY embedding <=> query  (HNSW index, cosine)
   │            → top-4 chunks above a similarity threshold
   ▼
[2 · AUGMENT]   retrieved chunks injected into the prompt as CONTEXT
   │            + strict grounding rules ("only use the context, never invent")
   ▼
[3 · GENERATE]  Groq · Llama 3.3 70B writes the answer, streamed token by token
   │
   ▼
Respuesta + fuentes citadas
```

## Tech Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | Frontend + API in one deploy |
| Embeddings | **Google** `gemini-embedding-001` (768-d) | Hosted, multilingual, free tier — a plain HTTPS call, so it runs on Vercel's serverless runtime |
| Vector store | PostgreSQL + **pgvector** (HNSW) | Real vector search; Neon supports it on the free tier |
| LLM | **Groq** · Llama 3.3 70B | Free tier, very fast inference, streaming |
| Styling | Tailwind CSS v4 | — |

## Knowledge base

Four markdown documents for the fictional retailer **Northwind** (`content/`): shipping, returns & warranty, payment methods, and company info. The ingest script chunks them by section (with overlap), embeds each chunk, and stores it in `pgvector` — **25 chunks** in total.

To use your own knowledge base, drop your `.md` files into `content/` and re-run the ingest.

## Run locally

Requires Node 20+, Docker, a free [Groq API key](https://console.groq.com) and a free [Gemini API key](https://aistudio.google.com/apikey).

```bash
npm install

cp .env.example .env      # add GROQ_API_KEY and GEMINI_API_KEY

# PostgreSQL with pgvector (host port 5434)
docker compose up -d

# Chunk → embed (Gemini) → store in pgvector
npm run ingest

npm run dev               # http://localhost:3000
```

## Verified behaviour

| Question | Answer |
| --- | --- |
| *¿Cuántos días tengo para devolver un producto?* | "30 días calendario… excepto Belleza, que es de 10 días." ✅ |
| *¿Cuánto cuesta el envío express?* | "19 USD, sin importar el valor de la compra." ✅ |
| *¿Cuál es el salario del CEO?* | "No tengo esa información en la documentación de Northwind." ✅ |

## Deploy (Vercel + Neon)

1. Create a Postgres database on [neon.tech](https://neon.tech). The ingest script enables `pgvector` automatically.
2. Run `npm run ingest` against the Neon `DATABASE_URL` (with `GEMINI_API_KEY` set) to populate the vector store.
3. Import the repo into Vercel and set `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL` and `GEMINI_API_KEY`.

## License

MIT
