"use client";

import { useId, useState, useTransition } from "react";
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
  const id = useId();

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
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-nombre`}>Nombre</label>
        <input
          id={`${id}-nombre`}
          required
          value={values.nombre}
          onChange={(e) => setValues({ ...values, nombre: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-especie`}>Especie</label>
        <input
          id={`${id}-especie`}
          required
          value={values.especie}
          onChange={(e) => setValues({ ...values, especie: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-sustrato`}>Sustrato</label>
        <input
          id={`${id}-sustrato`}
          value={values.sustrato}
          onChange={(e) => setValues({ ...values, sustrato: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-fecha-inicio`}>Fecha de inicio</label>
        <input
          id={`${id}-fecha-inicio`}
          type="date"
          required
          value={values.fecha_inicio}
          onChange={(e) => setValues({ ...values, fecha_inicio: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-estado`}>Estado</label>
        <select
          id={`${id}-estado`}
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
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-notas`}>Notas</label>
        <textarea
          id={`${id}-notas`}
          value={values.notas}
          onChange={(e) => setValues({ ...values, notas: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
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
