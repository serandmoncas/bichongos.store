"use client";

import { useRef, useState, type ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

/**
 * Pestañas accesibles de la página GrowBox.
 *
 * El contenido de cada panel llega ya renderizado desde el servidor: este
 * componente solo decide cuál se muestra. Así la página sigue siendo estática
 * salvo por el cambio de pestaña, y el texto entero está en el HTML inicial
 * (importa para SEO y para quien navegue sin JavaScript activo).
 */
export function Tabs({ items }: { items: TabItem[] }) {
  const [activo, setActivo] = useState(0);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);

  function activar(indice: number, mover: boolean) {
    setActivo(indice);
    if (mover) botones.current[indice]?.focus();
  }

  function alPulsarTecla(evento: React.KeyboardEvent, indice: number) {
    const total = items.length;
    const salto =
      evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;

    if (salto !== 0) {
      evento.preventDefault();
      activar((indice + salto + total) % total, true);
    } else if (evento.key === "Home") {
      evento.preventDefault();
      activar(0, true);
    } else if (evento.key === "End") {
      evento.preventDefault();
      activar(total - 1, true);
    }
  }

  return (
    <>
      <nav className="tabs">
        <div
          className="wrap tabs-in"
          role="tablist"
          aria-label="Secciones de la presentación"
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              ref={(el) => {
                botones.current[i] = el;
              }}
              className="tab"
              role="tab"
              id={`t-${item.id}`}
              aria-controls={`p-${item.id}`}
              aria-selected={i === activo}
              tabIndex={i === activo ? 0 : -1}
              onClick={() => activar(i, false)}
              onKeyDown={(e) => alPulsarTecla(e, i)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main>
        {items.map((item, i) => (
          <div
            key={item.id}
            className="panel"
            id={`p-${item.id}`}
            role="tabpanel"
            aria-labelledby={`t-${item.id}`}
            hidden={i !== activo}
          >
            {item.content}
          </div>
        ))}
      </main>
    </>
  );
}
