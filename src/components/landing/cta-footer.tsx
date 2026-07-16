import { Logo } from "@/components/logo";
import { WhatsAppButton } from "@/components/whatsapp-button";

export function CtaFooter() {
  return (
    <footer className="bg-tinta px-6 py-20 text-crema-claro sm:px-12">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
          ¿Restaurante, tienda o querés probar Bichongos?
        </h2>
        <WhatsAppButton label="Escribinos por WhatsApp" />
        <Logo variant="mono-negative" />
        <div className="flex flex-col gap-1 font-mono text-xs uppercase tracking-widest text-crema-claro/60">
          <p>Guarne, Antioquia</p>
          <p>Con la asesoría técnica de Songo Sorhongo</p>
        </div>
      </div>
    </footer>
  );
}
