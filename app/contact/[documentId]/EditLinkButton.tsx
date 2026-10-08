"use client";

import Link from "next/link";

export default function EditLinkButton({ documentId }: { documentId: string }) {
  const next = `/contact/${encodeURIComponent(documentId)}/edit`;
  return (
    <div className="grid gap-2 rounded-[18px] border border-[#dfe6e4] bg-[rgba(255,255,255,0.86)] px-[18px] py-4 text-[#111318]">
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-[linear-gradient(180deg,#ffffff,#f6fbf8)] px-4 py-[11px] font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-progress disabled:opacity-65"
      >
        Ich bin diese Person – mit UKB-Konto bearbeiten
      </Link>
      <p className="m-0 text-[0.95rem] text-[#2f3640]">
        Nur die zugehörige Person kann sich mit ihrem UKB-Netzwerk-Konto anmelden und diesen Eintrag bearbeiten.
      </p>
    </div>
  );
}
