import { notFound } from "next/navigation";
import { Suspense } from "react";
import { E2ELoginForm } from "./e2e-login-form";

export default function E2ELoginPage() {
  if (process.env.NEXT_PUBLIC_E2E_TEST_MODE !== "true") {
    notFound();
  }

  return (
    <Suspense>
      <E2ELoginForm />
    </Suspense>
  );
}
