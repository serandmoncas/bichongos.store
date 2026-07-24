"use client";

import { useTransition } from "react";
import { updateUserRole, updateUserEstado, type UserRole } from "./actions";
import { canEditRow } from "@/lib/admin/can-edit-own-row";

const ROLES: UserRole[] = ["pendiente", "estudiante", "operador", "profesor", "admin"];

export function UserRowControls({
  profile,
  currentUserId,
}: {
  profile: { id: string; role: UserRole; estado: string };
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const editable = canEditRow(currentUserId, profile.id);

  return (
    <>
      <td className="py-2">
        <select
          defaultValue={profile.role}
          disabled={!editable || isPending}
          onChange={(e) => {
            const role = e.target.value as UserRole;
            startTransition(() => {
              updateUserRole(profile.id, role);
            });
          }}
          className="border border-tinta/20 bg-transparent px-2 py-1 disabled:opacity-40"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2">
        <button
          type="button"
          disabled={!editable || isPending}
          onClick={() => {
            const next = profile.estado === "activo" ? "inactivo" : "activo";
            startTransition(() => {
              updateUserEstado(profile.id, next);
            });
          }}
          className="uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
        >
          {profile.estado}
        </button>
      </td>
    </>
  );
}
