import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ROLES_QUE_SUPERVISAN = ["profesor", "admin"];

export default async function ProgresoPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.sub)
    .single();

  if (!profile || !ROLES_QUE_SUPERVISAN.includes(profile.role)) {
    redirect("/admin/contenidos");
  }

  type Persona = { id: string; nombre: string | null; email: string; role: string };

  const { data: personas }: { data: Persona[] | null } = await supabase.rpc(
    "listar_usuarios_aprobados"
  );

  // Sin límite explícito, y `supabase/config.toml` fija max_rows = 1000: pasado ese
  // umbral (aprox. 47 personas x 21 contenidos a la escala actual) PostgREST trunca
  // la respuesta sin error, y algunos conteos por persona quedarían silenciosamente
  // por debajo del real. A la escala de hoy es irrelevante, pero antes de que el
  // equipo o la biblioteca de contenidos crezcan más allá de ese techo, esto necesita
  // una agregación del lado del servidor (p. ej. una función RPC que haga el count
  // agrupado en Postgres) en vez de traer todas las filas para sumarlas en memoria.
  const { data: lecturas } = await supabase.from("lecturas").select("user_id");

  const { count: totalContenidos } = await supabase
    .from("contenidos")
    .select("id", { count: "exact", head: true });

  const total = totalContenidos ?? 0;
  const conteoPorUsuario = new Map<string, number>();
  for (const lectura of lecturas ?? []) {
    conteoPorUsuario.set(lectura.user_id, (conteoPorUsuario.get(lectura.user_id) ?? 0) + 1);
  }

  const filas = (personas ?? [])
    .map((persona) => {
      const leidos = conteoPorUsuario.get(persona.id) ?? 0;
      return {
        ...persona,
        leidos,
        porcentaje: total === 0 ? 0 : Math.round((leidos / total) * 100),
      };
    })
    .sort((a, b) => b.porcentaje - a.porcentaje);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Progreso</h1>
      <p className="mt-1 font-mono text-sm text-tinta/60">
        Avance del equipo sobre {total} contenidos
      </p>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Persona</th>
            <th className="py-2 pr-4">Rol</th>
            <th className="py-2 pr-4">Leídos</th>
            <th className="py-2">Avance</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/progreso/${fila.id}`}
                  className="text-musgo-oscuro underline"
                >
                  {fila.nombre ?? fila.email}
                </Link>
              </td>
              <td className="py-2 pr-4">{fila.role}</td>
              <td className="py-2 pr-4">
                {fila.leidos} / {total}
              </td>
              <td className="py-2">{fila.porcentaje} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
