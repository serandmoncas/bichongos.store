const WHATSAPP_NUMBER = "573052779142";

export function WhatsAppButton({ label }: { label: string }) {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir a Bichongos por WhatsApp"
      className="inline-flex items-center justify-center rounded bg-musgo-oscuro px-6 py-3 font-mono text-sm font-medium uppercase tracking-wide text-crema-claro transition-opacity hover:opacity-90"
    >
      {label}
    </a>
  );
}
