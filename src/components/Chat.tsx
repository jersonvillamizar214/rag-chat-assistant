"use client";

import { useRef, useState } from "react";

interface Source {
  source: string;
  title: string;
  similarity: number;
  snippet: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

const SUGGESTIONS = [
  "¿Cuántos días tengo para devolver un producto?",
  "¿Cuánto cuesta el envío express?",
  "¿Qué cubre la garantía de electrónica?",
  "¿Puedo pagar contra entrega?",
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(question: string) {
    const text = question.trim();
    if (!text || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error("request failed");

      // Sources arrive in a header, before the streamed answer.
      const header = res.headers.get("X-Sources");
      const sources: Source[] = header
        ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(header), (c) => c.charCodeAt(0))))
        : [];

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "assistant", content: answer, sources }]);
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      }
    } catch {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: "Ocurrió un error al consultar el asistente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[600px] flex-col rounded-2xl border border-white/10 bg-slate-900">
      {/* Messages */}
      <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-violet-500/15 text-2xl">
              🤖
            </div>
            <p className="mt-4 font-medium text-white">Asistente de Copower</p>
            <p className="mt-1 max-w-sm text-sm text-slate-400">
              Pregunta sobre envíos, devoluciones, garantía o pagos. Solo respondo con
              la documentación oficial.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-violet-500/40 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[80%]" : "w-full"}>
              <div
                className={
                  m.role === "user"
                    ? "rounded-2xl rounded-br-sm bg-violet-600 px-4 py-2.5 text-sm text-white"
                    : "rounded-2xl rounded-bl-sm border border-white/10 bg-slate-950 px-4 py-3 text-sm leading-relaxed text-slate-200"
                }
              >
                {m.content || (
                  <span className="inline-flex gap-1">
                    <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
                  </span>
                )}
              </div>

              {/* Retrieved sources — the proof this is RAG, not a plain chatbot. */}
              {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                <details className="mt-2">
                  <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300">
                    📚 {m.sources.length} fuentes recuperadas
                  </summary>
                  <div className="mt-2 space-y-2">
                    {m.sources.map((s, j) => (
                      <div
                        key={j}
                        className="rounded-lg border border-white/10 bg-slate-950/60 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-violet-300">
                            {s.title}
                          </p>
                          <span className="font-mono text-[10px] text-slate-500">
                            {(s.similarity * 100).toFixed(0)}% similitud
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-slate-500">
                          {s.source}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-400">{s.snippet}…</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-white/10 p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={loading}
          className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {loading ? "…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500"
      style={{ animationDelay: delay }}
    />
  );
}
