import Groq from "groq-sdk";
import { retrieve, MIN_SIMILARITY } from "@/lib/retrieve";

// transformers.js (ONNX) needs the Node runtime — not the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

// Created on first request, not at import time — otherwise a build without
// GROQ_API_KEY (e.g. in CI) would fail while loading this module.
let client: Groq | null = null;
function getGroq(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Falta GROQ_API_KEY");
  client ??= new Groq({ apiKey });
  return client;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// The grounding rules are what make this RAG rather than a plain chatbot:
// the model may only use the retrieved context, and must say so when it can't.
const SYSTEM_PROMPT = `Eres el asistente virtual de Northwind, una tienda de comercio electrónico.

Reglas estrictas:
- Responde ÚNICAMENTE con información del CONTEXTO que se te entrega.
- Si el contexto no contiene la respuesta, di exactamente: "No tengo esa información en la documentación de Northwind." No inventes datos.
- No inventes precios, plazos, correos ni políticas que no aparezcan en el contexto.
- Responde en español, de forma breve y concreta (máximo 5 frases).
- Cuando cites un dato (un plazo, un costo), menciónalo con precisión tal como aparece.`;

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    const question = messages.filter((m) => m.role === "user").at(-1)?.content?.trim();

    if (!question) {
      return new Response(JSON.stringify({ error: "Falta la pregunta" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. RETRIEVE — semantic search over the vector store.
    const all = await retrieve(question, 4);
    const chunks = all.filter((c) => c.similarity >= MIN_SIMILARITY);

    // 2. AUGMENT — build the context block from the retrieved chunks.
    const context = chunks.length
      ? chunks
          .map((c, i) => `[Fuente ${i + 1} — ${c.title} (${c.source})]\n${c.content}`)
          .join("\n\n---\n\n")
      : "(No se encontró información relevante en la documentación.)";

    // Sources travel in a header so the body stays a clean text stream.
    const sources = chunks.map((c) => ({
      source: c.source,
      title: c.title,
      similarity: Number(c.similarity.toFixed(3)),
      snippet: c.content.replace(/\n/g, " ").slice(0, 160),
    }));

    // 3. GENERATE — the LLM answers using only that context.
    const history = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      temperature: 0.2, // low → factual, less creative
      max_tokens: 500,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice(0, -1),
        {
          role: "user",
          content: `CONTEXTO:\n${context}\n\nPREGUNTA: ${question}`,
        },
      ],
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of completion) {
            const token = part.choices[0]?.delta?.content ?? "";
            if (token) controller.enqueue(encoder.encode(token));
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode("\n\n[Error al generar la respuesta.]")
          );
          console.error("stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        // base64 keeps accents valid in an HTTP header.
        "X-Sources": Buffer.from(JSON.stringify(sources), "utf8").toString("base64"),
      },
    });
  } catch (err) {
    console.error("chat error:", err);
    return new Response(
      JSON.stringify({ error: "Error del servidor al procesar la consulta." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
