import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
