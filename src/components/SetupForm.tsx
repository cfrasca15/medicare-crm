"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setupAccount } from "@/lib/actions/auth";

export function SetupForm() {
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
            await setupAccount(formData);
            router.push("/");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Setup failed.");
          }
        });
      }}
      className="surface flex w-full max-w-sm flex-col gap-4 p-6"
    >
      <div>
        <h1 className="text-xl font-semibold">Create your login</h1>
        <p className="muted mt-1 text-sm">
          This is a one-time setup — pick the email and password you&apos;ll use
          to sign in to your CRM from now on.
        </p>
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
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="field"
        />
        <span className="muted text-xs">At least 8 characters.</span>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          className="field"
        />
      </div>
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
