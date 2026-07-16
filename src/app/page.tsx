import { Hero } from "@/components/landing/hero";
import { Problema } from "@/components/landing/problema";
import { ComoFunciona } from "@/components/landing/como-funciona";
import { Producto } from "@/components/landing/producto";
import { CtaFooter } from "@/components/landing/cta-footer";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <Problema />
        <ComoFunciona />
        <Producto />
      </main>
      <CtaFooter />
    </>
  );
}
