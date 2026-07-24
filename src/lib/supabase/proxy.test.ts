import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "./proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockCreateServerClient = vi.mocked(createServerClient);

function mockClaims(claims: { sub: string } | null) {
  mockCreateServerClient.mockReturnValue({
    auth: {
      getClaims: vi.fn().mockResolvedValue(claims ? { data: { claims } } : { data: null }),
    },
  } as never);
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirige a /login cuando no hay sesión y la ruta es /admin", async () => {
    mockClaims(null);
    const request = new NextRequest("http://localhost:3000/admin");

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("redirige a /login cuando no hay sesión y la ruta es /pendiente", async () => {
    mockClaims(null);
    const request = new NextRequest("http://localhost:3000/pendiente");

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("no redirige cuando no hay sesión y la ruta es pública", async () => {
    mockClaims(null);
    const request = new NextRequest("http://localhost:3000/");

    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
  });

  it("no redirige a /admin cuando hay sesión", async () => {
    mockClaims({ sub: "user-123" });
    const request = new NextRequest("http://localhost:3000/admin");

    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
  });
});
