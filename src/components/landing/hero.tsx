import { Logo } from "@/components/logo";
import { WhatsAppButton } from "@/components/whatsapp-button";

export function Hero() {
  return (
    <section className="flex flex-col items-center gap-8 px-6 py-24 text-center sm:px-12">
      <Logo variant="horizontal" />
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl font-semibold sm:text-5xl">
          Bichongos
        </h1>
        <p className="mx-auto max-w-xl font-serif text-xl italic text-tinta/80 sm:text-2xl">
          Hongos premium cultivados con precisión IoT, trazables del sustrato
          al plato.
        </p>
        <p className="font-mono text-xs uppercase tracking-widest text-tinta/60">
          Laboratorio de cultivo · Guarne, Antioquia
        </p>
      </div>
      <WhatsAppButton label="Escribinos por WhatsApp" />
    </section>
  );
}
