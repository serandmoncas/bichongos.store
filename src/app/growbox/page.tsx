import type { Metadata } from "next";
import Image from "next/image";
import { Fraunces, Karla } from "next/font/google";

import { CtaFooter } from "@/components/landing/cta-footer";
import { Tabs } from "@/components/growbox/tabs";
import { PanelSistema } from "@/components/growbox/panel-sistema";
import { PanelControl } from "@/components/growbox/panel-control";
import { PanelApp } from "@/components/growbox/panel-app";
import { PanelHomeAssistant } from "@/components/growbox/panel-home-assistant";

import "./growbox.css";

// Tipografías propias de esta página: no las usa el resto del sitio, así que se
// cargan aquí y no en el layout raíz.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cápsula de cultivo GrowBox · Bichongos",
  description:
    "La cápsula de cultivo IoT que mide su propio clima, lo corrige sola y se consulta desde el móvil. El sistema, el panel de control, la app y su integración en Home Assistant.",
};

export default function GrowboxPage() {
  return (
    <>
      <div className={`growbox ${fraunces.variable} ${karla.variable}`}>
        <header className="hero">
          <Image
            className="hero-img"
            src="/growbox/capsula-hero.jpg"
            alt="Ilustración de una cápsula de cultivo con hongos ostra y lecturas de temperatura, humedad y CO2"
            width={1800}
            height={594}
            sizes="100vw"
            priority
          />
          <div className="hero-body wrap">
            <p className="eyebrow" style={{ marginBottom: 18 }}>
              Cápsula de cultivo · GrowBox
            </p>
            <h1>
              Una caja que sabe
              <br />
              cultivar hongos
            </h1>
            <p className="lede">
              Mide su propio clima, lo corrige sola y te lo cuenta desde el
              móvil. Porque cultivar hongos no falla por descuido: falla por unas
              horas de descuadre a las tres de la mañana.
            </p>
            <div className="hero-meta">
              <span>Orellana · Melena de león · Shiitake</span>
              <span>
                Actualizado <b>22 ago 2026</b>
              </span>
            </div>
          </div>
        </header>

        <Tabs
          items={[
            {
              id: "sistema",
              label: "El sistema",
              content: <PanelSistema />,
            },
            {
              id: "panel",
              label: "El panel de control",
              content: <PanelControl />,
            },
            {
              id: "app",
              label: "La app móvil",
              content: <PanelApp />,
            },
            {
              id: "ha",
              label: "Home Assistant",
              content: <PanelHomeAssistant />,
            },
          ]}
        />

        <footer className="wrap prov">
          <p className="foot" style={{ marginTop: 0 }}>
            Las fotografías de <b>El sistema</b> son ilustraciones de concepto.
            <br />
            Las de <b>El panel de control</b>, <b>La app móvil</b> y{" "}
            <b>Home Assistant</b> son capturas reales.
            <br />
            Panel y domótica, tomados el 22 de agosto de 2026 con la cápsula en
            funcionamiento.
            <br />
            La app, el 26 de agosto contra el backend de producción, con la
            cápsula ya apagada.
          </p>
        </footer>
      </div>

      <CtaFooter />
    </>
  );
}
