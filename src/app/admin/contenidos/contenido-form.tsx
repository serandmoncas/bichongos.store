"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContenidoCategoria, ContenidoFormValues } from "./actions";

const CATEGORIAS: { value: ContenidoCategoria; label: string }[] = [
  { value: "ficha_especie", label: "Ficha de especie" },
  { value: "sop", label: "SOP" },
];

export function ContenidoForm({
  initialValues,
  onSubmit,
}: {
  initialValues: ContenidoFormValues;
  onSubmit: (values: ContenidoFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="flex max-w-2xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await onSubmit(values);
            router.push("/admin/contenidos");
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Título
        <input
          required
          value={values.titulo}
          onChange={(e) => setValues({ ...values, titulo: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Categoría
        <select
          value={values.categoria}
          onChange={(e) =>
            setValues({ ...values, categoria: e.target.value as ContenidoCategoria })
          }
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Nivel
        <input
          value={values.nivel}
          onChange={(e) => setValues({ ...values, nivel: e.target.value })}
          placeholder="N1, N2, N3, N4…"
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Cuerpo (Markdown)
        <textarea
          required
          rows={20}
          value={values.cuerpo}
          onChange={(e) => setValues({ ...values, cuerpo: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1 font-mono"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        Guardar
      </button>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </form>
  );
}
