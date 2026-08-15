"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CompetenciaFormValues } from "./actions";

export function CompetenciaForm({
  initialValues,
  onSubmit,
  mode = "create",
}: {
  initialValues: CompetenciaFormValues;
  onSubmit: (values: CompetenciaFormValues) => Promise<void>;
  mode?: "create" | "edit";
}) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const id = useId();

  return (
    <form
      className="mt-4 flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await onSubmit(values);
            if (mode === "edit") {
              router.push("/admin/competencias");
            } else {
              setValues(initialValues);
              router.refresh();
            }
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
        <label htmlFor={`${id}-descripcion`}>Descripción</label>
        <textarea
          id={`${id}-descripcion`}
          value={values.descripcion}
          onChange={(e) => setValues({ ...values, descripcion: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </div>
      <div className="flex items-center gap-2 font-mono text-sm text-tinta/70">
        <input
          id={`${id}-habilita-operar`}
          type="checkbox"
          checked={values.habilita_operar}
          onChange={(e) => setValues({ ...values, habilita_operar: e.target.checked })}
        />
        <label htmlFor={`${id}-habilita-operar`}>Habilita operar</label>
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
