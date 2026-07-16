const LINEAS = [
  {
    nombre: "Frescos gourmet",
    detalle: "Orellana, shiitake, melena de león, enoki, portobello.",
  },
  {
    nombre: "Secos y polvo",
    detalle: "Reishi, melena de león y shiitake en bolsa o frasco.",
  },
  {
    nombre: "Extractos dobles",
    detalle: "Reishi, melena, cordyceps y blend \"Inmunidad\".",
  },
  {
    nombre: "Servicios",
    detalle: "Kits de cultivo, licencia del sistema, consultoría y escuela de fungicultura.",
  },
];

export function Producto() {
  return (
    <section className="bg-crema-claro px-6 py-20 sm:px-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
          Cuatro líneas de producto, un mismo sistema
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {LINEAS.map((l) => (
            <div
              key={l.nombre}
              className="rounded border border-tinta/10 bg-crema p-6"
            >
              <h3 className="font-serif text-lg font-semibold">{l.nombre}</h3>
              <p className="mt-2 font-mono text-sm text-tinta/70">
                {l.detalle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
