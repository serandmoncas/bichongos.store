"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRegistro, type RegistroTipo } from "../registros-actions";

const TIPOS: { value: RegistroTipo; label: string }[] = [
  { value: "riego", label: "Riego" },
  { value: "humedad", label: "Humedad" },
  { value: "temperatura", label: "Temperatura" },
  { value: "observacion", label: "Observación" },
];

export function RegistroForm({ loteId }: { loteId: string }) {
  const [tipo, setTipo] = useState<RegistroTipo>("observacion");
  const [valor, setValor] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const id = useId();

  const trimmed = valor.trim();

  return (
    <form
      className="mt-4 flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        setError(null);
        startTransition(async () => {
          try {
            await createRegistro(loteId, tipo, trimmed);
            setValor("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo registrar.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-tipo`}>Tipo</label>
        <select
          id={`${id}-tipo`}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as RegistroTipo)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-valor`}>Valor</label>
        <input
          id={`${id}-valor`}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </div>
      <button
        type="submit"
        disabled={!trimmed || isPending}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        Registrar
      </button>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </form>
  );
}
