import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export type TestRole = "pendiente" | "estudiante" | "operador" | "profesor" | "admin";

export interface TestUser {
  email: string;
  password: string;
}

export async function createTestUser(role: TestRole): Promise<TestUser> {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está seteada — necesaria para crear usuarios de prueba"
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const id = randomUUID();
  const email = `e2e-${id}@bichongos.test`;
  const password = `Test-${id}`;

  const { error: createError } = await admin.auth.admin.createUser({
    id,
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    throw new Error(`No se pudo crear el usuario de prueba: ${createError.message}`);
  }

  if (role !== "pendiente") {
    const db = new Client({ connectionString: DB_URL });
    await db.connect();
    try {
      await db.query("set session_replication_role = replica");
      await db.query("update public.profiles set role = $1 where id = $2", [role, id]);
      await db.query("set session_replication_role = default");
    } finally {
      await db.end();
    }
  }

  return { email, password };
}
