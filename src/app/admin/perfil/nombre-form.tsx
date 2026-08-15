"use client";

import { useId, useState, useTransition } from "react";
import { updateOwnNombre } from "./actions";

export function NombreForm({ nombre }: { nombre: string | null }) {
  const [value, setValue] = useState(nombre ?? "");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  // useId en vez de un id fijo: "nombre" es un id genérico que colisionaría
  // si esta página llegara a montar otro formulario con el mismo campo.
  const id = useId();

  const trimmed = value.trim();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        setFeedback(null);
        startTransition(async () => {
          try {
            await updateOwnNombre(trimmed);
            setFeedback("Guardado.");
          } catch (err) {
            setFeedback(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
    >
      <label className="font-mono text-sm text-tinta/70" htmlFor={`${id}-nombre`}>
        Nombre
      </label>
      <input
        id={`${id}-nombre`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border border-tinta/20 bg-transparent px-2 py-1 font-mono text-sm"
      />
      <button
        type="submit"
        disabled={!trimmed || isPending}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        Guardar
      </button>
      {feedback && <p className="font-mono text-sm text-tinta/70">{feedback}</p>}
    </form>
  );
}
