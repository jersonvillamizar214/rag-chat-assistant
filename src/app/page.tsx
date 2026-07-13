import Chat from "@/components/Chat";

const PIPELINE = [
  {
    step: "1 · Retrieve",
    title: "Búsqueda semántica",
    desc: "La pregunta se convierte en un vector de 384 dimensiones y se buscan los fragmentos más cercanos en pgvector (distancia coseno, índice HNSW).",
  },
  {
    step: "2 · Augment",
    title: "Contexto inyectado",
    desc: "Los fragmentos recuperados se insertan en el prompt como contexto verificable, con instrucciones estrictas de no inventar.",
  },
  {
    step: "3 · Generate",
    title: "Respuesta con Groq",
    desc: "Llama 3.3 (70B) redacta la respuesta usando solo ese contexto y la transmite en streaming token a token.",
  },
];

const STACK = [
  "Next.js 16",
  "TypeScript",
  "PostgreSQL + pgvector",
  "transformers.js",
  "Groq · Llama 3.3",
  "Tailwind CSS",
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="text-center">
        <span className="inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
          Proyecto de portafolio · IA aplicada
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Chat empresarial con <span className="text-violet-400">RAG</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
          Un asistente que responde <strong className="text-slate-200">solo</strong> con la
          documentación interna de la empresa. Sin alucinaciones: cada respuesta muestra
          las fuentes que usó.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {STACK.map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      <section className="mt-10">
        <Chat />
      </section>

      <section className="mt-12">
        <h2 className="text-center text-lg font-semibold">Cómo funciona el pipeline RAG</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PIPELINE.map((p) => (
            <div
              key={p.step}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-6"
            >
              <p className="font-mono text-xs text-violet-400">{p.step}</p>
              <h3 className="mt-2 font-semibold text-white">{p.title}</h3>
              <p className="mt-1.5 text-sm text-slate-400">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-14 border-t border-white/10 pt-8 text-center text-sm text-slate-500">
        Base de conocimiento: documentación ficticia de Northwind (envíos, devoluciones,
        garantía, pagos) —{" "}
        <a
          href="https://github.com/jersonvillamizar214"
          className="text-slate-400 hover:text-white"
        >
          @jersonvillamizar214
        </a>
      </footer>
    </main>
  );
}
