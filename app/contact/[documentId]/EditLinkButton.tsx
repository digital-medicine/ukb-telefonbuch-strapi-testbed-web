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
    <div className="edit-request">
      <button className="edit-request-button" onClick={handleClick} disabled={loading} type="button">
        {loading ? "Sende Link..." : "Ich bin diese Person - Bearbeitungslink per E-Mail anfordern"}
      </button>
      <p className="edit-request-note">
        Bitte nur ausloesen, wenn du diese Person selbst bist. Der Link wird nur an die Business-E-Mail gesendet.
      </p>
      {message ? <p className="edit-request-success">{message}</p> : null}
      {error ? <p className="edit-request-error">{error}</p> : null}
    </div>
  );
}
