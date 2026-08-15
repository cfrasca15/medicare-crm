"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/actions/auth";

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            await login(formData);
            router.push("/");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed.");
          }
        });
      }}
      className="surface flex w-full max-w-sm flex-col gap-4 p-6"
    >
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="muted mt-1 text-sm">Medicare CRM</p>
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required autoFocus className="field" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" required className="field" />
      </div>
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
