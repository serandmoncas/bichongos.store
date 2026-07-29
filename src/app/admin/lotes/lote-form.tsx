"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LoteEstado, LoteFormValues } from "./actions";

const ESTADOS: LoteEstado[] = ["incubacion", "fructificacion", "cosechado", "finalizado"];

export function LoteForm({
  initialValues,
  onSubmit,
}: {
  initialValues: LoteFormValues;
  onSubmit: (values: LoteFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await onSubmit(values);
            router.push("/admin/lotes");
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Nombre
        <input
          required
          value={values.nombre}
          onChange={(e) => setValues({ ...values, nombre: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Especie
        <input
          required
          value={values.especie}
          onChange={(e) => setValues({ ...values, especie: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Sustrato
        <input
          value={values.sustrato}
          onChange={(e) => setValues({ ...values, sustrato: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Fecha de inicio
        <input
          type="date"
          required
          value={values.fecha_inicio}
          onChange={(e) => setValues({ ...values, fecha_inicio: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Estado
        <select
          value={values.estado}
          onChange={(e) => setValues({ ...values, estado: e.target.value as LoteEstado })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Notas
        <textarea
          value={values.notas}
          onChange={(e) => setValues({ ...values, notas: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
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
