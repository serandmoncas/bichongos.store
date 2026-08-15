"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContenidoFormValues } from "./actions";
import { CATEGORIAS, type ContenidoCategoria } from "./categorias";

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
  const id = useId();

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
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-titulo`}>Título</label>
        <input
          id={`${id}-titulo`}
          required
          value={values.titulo}
          onChange={(e) => setValues({ ...values, titulo: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-categoria`}>Categoría</label>
        <select
          id={`${id}-categoria`}
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
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-nivel`}>Nivel</label>
        <input
          id={`${id}-nivel`}
          value={values.nivel}
          onChange={(e) => setValues({ ...values, nivel: e.target.value })}
          placeholder="N1, N2, N3, N4…"
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-cuerpo`}>Cuerpo (Markdown)</label>
        <textarea
          id={`${id}-cuerpo`}
          required
          rows={20}
          value={values.cuerpo}
          onChange={(e) => setValues({ ...values, cuerpo: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1 font-mono"
        />
      </div>
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
