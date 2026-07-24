import { describe, expect, it } from "vitest";
import { canEditRow } from "./can-edit-own-row";

describe("canEditRow", () => {
  it("permite editar filas de otros usuarios", () => {
    expect(canEditRow("user-a", "user-b")).toBe(true);
  });

  it("no permite editar la propia fila", () => {
    expect(canEditRow("user-a", "user-a")).toBe(false);
  });
});
