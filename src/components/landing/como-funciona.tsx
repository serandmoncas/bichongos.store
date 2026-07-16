const VARIABLES = ["Temperatura", "Humedad", "CO₂", "Luz"];

export function ComoFunciona() {
  return (
    <section className="px-6 py-20 sm:px-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
          La cápsula de cultivo controlada por IoT
        </h2>
        <p className="mt-4 max-w-2xl font-serif text-lg italic text-tinta/80">
          Cada especie habita una cámara hermética que recrea su microclima
          exacto. El sistema lee sensores cada 30 segundos y ajusta
          temperatura, humedad, CO₂ y luz según el perfil activo.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {VARIABLES.map((v) => (
            <span
              key={v}
              className="rounded-full border border-tinta/20 px-4 py-2 font-mono text-sm"
            >
              {v}
            </span>
          ))}
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-serif text-4xl font-semibold text-musgo">
              &lt; 24 h
            </p>
            <p className="font-mono text-xs uppercase tracking-widest text-tinta/60">
              de cosechado a entrega
            </p>
          </div>
          <div>
            <p className="font-serif text-4xl font-semibold text-musgo">QR</p>
            <p className="font-mono text-xs uppercase tracking-widest text-tinta/60">
              historial por lote en la mesa
            </p>
          </div>
        </div>
        <p className="mt-8 max-w-2xl font-mono text-sm text-tinta/70">
          Cada lote tiene un identificador único con el historial completo de
          cultivo — del sustrato al plato en menos de 24 horas.
        </p>
      </div>
    </section>
  );
}
