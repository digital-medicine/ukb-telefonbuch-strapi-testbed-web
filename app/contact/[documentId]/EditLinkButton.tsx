"use client";

import { useState } from "react";

export default function EditLinkButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/people/${encodeURIComponent(documentId)}/request-edit-link`, {
        method: "POST",
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(json?.error || "Versand fehlgeschlagen");
      }
      setMessage("Der Bearbeitungslink wurde an die hinterlegte Business-E-Mail gesendet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Versand fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-[18px] border border-[#dfe6e4] bg-[rgba(255,255,255,0.86)] px-[18px] py-4 text-[#111318]">
      <button
        className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-[linear-gradient(180deg,#ffffff,#f6fbf8)] px-4 py-[11px] font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-progress disabled:opacity-65"
        onClick={handleClick}
        disabled={loading}
        type="button"
      >
        {loading ? "Sende Link..." : "Ich bin diese Person - Bearbeitungslink per E-Mail anfordern"}
      </button>
      <p className="m-0 text-[0.95rem] text-[#2f3640]">
        Bitte nur auslösen, wenn du diese Person selbst bist. Der Link wird nur an die Business-E-Mail gesendet.
      </p>
      {message ? <p className="m-0 text-[0.95rem] text-[var(--accent)]">{message}</p> : null}
      {error ? (
        <p className="m-0 rounded-xl border border-[#dc8d8d] bg-[linear-gradient(180deg,#fff5f5,#ffe9e9)] px-[14px] py-3 text-[0.95rem] font-bold text-[#8d1717] shadow-[0_8px_20px_rgba(163,34,34,0.08)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
