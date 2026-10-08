"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "Anmeldung fehlgeschlagen.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Der Anmeldedienst ist nicht erreichbar. Bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  }
  return <form onSubmit={submit} className="grid gap-4">
    <label className="grid gap-1 text-sm font-medium text-[#263244]">Benutzername<input name="username" required autoComplete="username" className="rounded-lg border border-[#b9c3d0] px-3 py-2" /></label>
    <label className="grid gap-1 text-sm font-medium text-[#263244]">Passwort<input name="password" type="password" required autoComplete="current-password" className="rounded-lg border border-[#b9c3d0] px-3 py-2" /></label>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}
    <button disabled={busy} className="rounded-lg bg-[#145c86] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "Anmeldung läuft…" : "Anmelden"}</button>
  </form>;
}
