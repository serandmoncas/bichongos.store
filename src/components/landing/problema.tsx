const PUNTOS = [
  {
    titulo: "Importado y sin origen",
    texto:
      "El champiñón viene de Bogotá y el shiitake de China: 3–7 días de transporte y cero información de cómo se cultivó.",
  },
  {
    titulo: "Local pero a ciegas",
    texto:
      "El cultivo artesanal de la región tampoco registra humedad, lote ni condiciones — la calidad cambia de cosecha a cosecha y nadie sabe por qué.",
  },
  {
    titulo: "Sin respaldo funcional",
    texto:
      "Melena de león, reishi y cordyceps casi no se consiguen frescas y, sin datos de cultivo, no hay forma de garantizar su potencia.",
  },
];

export function Problema() {
  return (
    <section className="bg-tinta px-6 py-20 text-crema-claro sm:px-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
          Todo el hongo del mercado se cultiva a ciegas
        </h2>
        <p className="mt-4 max-w-2xl font-serif text-lg italic text-crema-claro/80">
          El problema no es solo la frescura: es la ausencia total de
          trazabilidad y datos de cultivo — tanto en el hongo importado como
          en el artesanal.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {PUNTOS.map((p) => (
            <div key={p.titulo}>
              <h3 className="font-serif text-lg font-semibold">{p.titulo}</h3>
              <p className="mt-2 font-mono text-sm text-crema-claro/70">
                {p.texto}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex gap-12">
          <div>
            <p className="font-serif text-4xl font-semibold text-terracota">
              3–7
            </p>
            <p className="font-mono text-xs uppercase tracking-widest text-crema-claro/60">
              días de frescura perdida
            </p>
          </div>
          <div>
            <p className="font-serif text-4xl font-semibold text-terracota">
              0
            </p>
            <p className="font-mono text-xs uppercase tracking-widest text-crema-claro/60">
              datos de humedad, lote y condiciones
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
