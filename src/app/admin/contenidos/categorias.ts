// Catálogo único de categorías de contenido.
//
// Agregar una categoría acá (más el valor en el enum `contenido_categoria` de
// la BD, con su migración) alcanza para que aparezca en el formulario de
// crear/editar, en los filtros de la lista y en las etiquetas de todas las
// pantallas. Antes esta lista vivía duplicada en cuatro archivos y agregar
// una categoría era un cambio disperso, fácil de dejar a medias.
//
// El plural va explícito y no derivado: en español no se pluraliza la última
// palabra sino el núcleo ("Ficha de especie" → "Fichas de especie") y hay
// siglas que no siguen ninguna regla ("SOP" → "SOPs").
//
// El orden de declaración es el orden en que se muestran las opciones y los
// filtros; no tiene relación con el orden del enum en Postgres.
const CATALOGO = {
  ficha_especie: { etiqueta: "Ficha de especie", plural: "Fichas de especie" },
  sop: { etiqueta: "SOP", plural: "SOPs" },
  administrativa: { etiqueta: "Administrativa", plural: "Administrativas" },
} as const;

export type ContenidoCategoria = keyof typeof CATALOGO;

export const CATEGORIAS: {
  value: ContenidoCategoria;
  label: string;
  plural: string;
}[] = Object.entries(CATALOGO).map(([value, { etiqueta, plural }]) => ({
  value: value as ContenidoCategoria,
  label: etiqueta,
  plural,
}));

/**
 * Estrecha un `string` cualquiera —un query param, una columna de la BD— al
 * tipo cerrado de categorías.
 *
 * Usa `Object.hasOwn` y no `valor in CATALOGO`: el operador `in` también
 * encuentra las propiedades heredadas de `Object.prototype`, así que
 * `?categoria=constructor` (o `toString`, `valueOf`…) pasaría por válido y se
 * iría a Postgres como si fuera un valor del enum.
 */
export function esCategoria(valor: string): valor is ContenidoCategoria {
  return Object.hasOwn(CATALOGO, valor);
}

/**
 * Etiqueta legible de una categoría. Si la BD trae un valor que este código
 * todavía no conoce —una categoría agregada al enum cuyo deploy del front no
 * ha salido— se muestra el valor crudo en vez de romper la página.
 */
export function etiquetaCategoria(valor: string): string {
  return esCategoria(valor) ? CATALOGO[valor].etiqueta : valor;
}
