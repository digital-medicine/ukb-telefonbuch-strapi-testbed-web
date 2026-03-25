/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Phone = { Label?: string | null; Number?: string | null };
type Mail = { Label?: string | null; Address?: string | null };
type Address = {
  Label?: string | null;
  StreetName?: string | null;
  StreetNumber?: string | null;
  Zip?: string | null;
  City?: string | null;
  State?: string | null;
  Country?: string | null;
};
type MediaFormat = { url?: string | null; width?: number | null; height?: number | null };
type Media = {
  url?: string | null;
  alternativeText?: string | null;
  formats?: Record<string, MediaFormat> | null;
};

type Secretariat = {
  id?: number | null;
  documentId?: string | null;
  Name?: string | null;
  MailIdentifier?: string | null;
  Email?: string | null;
  Phone?: string | null;
  Phones?: Phone[] | null;
  Mail?: Mail[] | null;
  Address?: Address[] | null;
  Organizations?: OrganizationInfo[] | null;
};

type OrganizationInfo = {
  id?: number | null;
  documentId?: string | null;
  Name?: string | null;
  ShortName?: string | null;
  AffiliationRole?: string | null;
  AffiliationPrimary?: boolean | null;
  LeadershipRoles?: string[] | null;
  LeadershipPrimary?: boolean | null;
};

type Publication = {
  id?: number | null;
  Title?: string | null;
  DOI?: string | null;
  Type?: string | null;
  PublishedDate?: string | null;
  Journal?: string | null;
  Volume?: string | null;
  Issue?: string | null;
  Pages?: string | null;
  URL?: string | null;
};

type PublicationLink = {
  id?: number | null;
  AuthorName?: string | null;
  AuthorOrder?: number | null;
  IsCorresponding?: boolean | null;
  Publication?: Publication | null;
};

type Person = {
  id: number;
  documentId?: string | null;
  Title?: string | null;
  Firstname?: string | null;
  Lastname?: string | null;
  MailIdentifier?: string | null;
  WebexEnabled?: boolean | null;
  WebexEmail?: string | null;
  Phone?: Phone[] | null;
  Mail?: Mail[] | null;
  Address?: Address[] | null;
  EmployeePicture?: Media | null;
  Secretariats?: Secretariat[] | null;
  Organizations?: OrganizationInfo[] | null;
  Publications?: PublicationLink[] | null;
};

function fmtName(p: Person) {
  return [p.Title, p.Firstname, p.Lastname].filter(Boolean).join(" ").trim() || "(ohne Namen)";
}

function fmtAddress(a: Address) {
  const line1 = [a.StreetName, a.StreetNumber].filter(Boolean).join(" ").trim();
  const line2 = [a.Zip, a.City].filter(Boolean).join(" ").trim();
  const line3 = [a.State, a.Country].filter(Boolean).join(", ").trim();
  return [line1, line2, line3].filter(Boolean).join(" · ");
}

function formatContactLabel(label?: string | null, fallback = "Kontakt") {
  const value = (label || "").trim().toLowerCase();
  switch (value) {
    case "business":
      return "Business";
    case "business mobile":
      return "Business Mobil";
    case "private":
      return "Privat";
    case "private mobile":
      return "Privat Mobil";
    case "fax":
      return "Fax";
    case "pager":
      return "Pager";
    case "assistant":
      return "Assistenz";
    case "other":
      return "Sonstiges";
    default:
      return label || fallback;
  }
}

function pickByLabel<T extends { Label?: string | null }>(
  items: T[] | null | undefined,
  preferred: string[]
) {
  const list = items || [];
  if (!list.length) return null;
  for (const pref of preferred) {
    const found = list.find((it) => (it?.Label || "").trim().toLowerCase() === pref.trim().toLowerCase());
    if (found) return found;
  }
  return list[0] || null;
}

function formatSecretariatPreview(list: Secretariat[] | null | undefined) {
  const entries = (list || []).slice(0, 2).map((s) => {
    const name = s.Name || s.MailIdentifier || "(ohne Namen)";
    const bits = [name];
    if (s.Email) bits.push(s.Email);
    if (s.Phone) bits.push(s.Phone);
    return bits.join(", ");
  });
  if (!entries.length) return null;
  const suffix = (list || []).length > 2 ? " …" : "";
  return `${entries.join(" | ")}${suffix}`;
}

function formatOrgPreview(list: OrganizationInfo[] | null | undefined) {
  const names = (list || [])
    .map((o) => o.ShortName || o.Name)
    .filter(Boolean)
    .slice(0, 3);
  if (!names.length) return null;
  const suffix = (list || []).length > 3 ? " …" : "";
  return `${names.join(", ")}${suffix}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  const value = text || "";
  const tokens = query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!value || !tokens.length) return value;

  const pattern = tokens.map(escapeRegExp).join("|");
  if (!pattern) return value;

  const parts = value.split(new RegExp(`(${pattern})`, "gi"));
  return parts.map((part, index) =>
    tokens.some((token) => part.toLowerCase() === token.toLowerCase()) ? (
      <mark key={`${part}-${index}`} className="search-highlight">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export default function Directory({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [sortBy, setSortBy] = useState<"Lastname" | "Firstname">("Lastname");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [labelFilter, setLabelFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [items, setItems] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; pageCount?: number; total?: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const params = new URLSearchParams();
        params.set("q", q);
        params.set("sort", `${sortBy}:${dir}`);
        if (labelFilter) params.set("label", labelFilter);

        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const res = await fetch(`/api/people?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${t}`);
        }
        const json = (await res.json()) as {
          items: Person[];
          pagination?: { page: number; pageSize: number; pageCount?: number; total?: number };
        };
        if (!cancelled) {
          setItems(json.items);
          setPagination(json.pagination ?? null);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Fehler beim Laden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const t = setTimeout(load, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, sortBy, dir, labelFilter, page, pageSize]);

  const labelOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of items) {
      for (const ph of p.Phone || []) {
        if (ph?.Label) s.add(ph.Label);
      }
    }
    return Array.from(s).sort();
  }, [items]);

  useEffect(() => {
    setPage(1);
  }, [q, sortBy, dir, labelFilter]);

  return (
    <section className="mx-auto my-7 max-w-[1100px] px-0">
      <div className="mb-[18px] grid gap-[10px] rounded-xl border border-[var(--card-border)] bg-white p-[14px] shadow-[0_10px_22px_rgba(18,24,40,0.06)] md:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(140px,1fr))_auto]">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nach Name suchen…"
          className="min-w-[220px] rounded-[10px] border border-[#dfe2e7] bg-white px-3 py-2.5 text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(31,111,91,0.14)]"
        />

        <label className="grid gap-1.5 text-[0.86rem] text-[var(--ink-soft)]">
          Sort:
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-[10px] border border-[#dfe2e7] bg-white px-2.5 py-2 text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(31,111,91,0.14)]"
          >
            <option value="Lastname">Nachname</option>
            <option value="Firstname">Vorname</option>
          </select>
        </label>

        <label className="grid gap-1.5 text-[0.86rem] text-[var(--ink-soft)]">
          Richtung:
          <select
            value={dir}
            onChange={(e) => setDir(e.target.value as any)}
            className="rounded-[10px] border border-[#dfe2e7] bg-white px-2.5 py-2 text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(31,111,91,0.14)]"
          >
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
        </label>

        <label className="grid gap-1.5 text-[0.86rem] text-[var(--ink-soft)]">
          Phone-Label:
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="rounded-[10px] border border-[#dfe2e7] bg-white px-2.5 py-2 text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(31,111,91,0.14)]"
          >
            <option value="">(alle)</option>
            {labelOptions.map((l) => (
              <option key={l} value={l}>
                {formatContactLabel(l, l)}
              </option>
            ))}
          </select>
        </label>

        <div className="self-center text-[0.9rem] text-[var(--ink-soft)] md:justify-self-end">
          {loading
            ? "Lade…"
            : pagination?.total
              ? `${pagination.total} Einträge`
              : `${items.length} Einträge`}
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-[#ee9ab7] bg-[#fff1f6] p-3 text-[#900]">Fehler: {err}</div>
      ) : null}

      <div className="grid gap-[14px]">
        {items.map((p) => {
          const pic =
            p.EmployeePicture?.formats?.small?.url ||
            p.EmployeePicture?.formats?.thumbnail?.url ||
            p.EmployeePicture?.url ||
            null;
          const alt = p.EmployeePicture?.alternativeText || fmtName(p);
          const previewPhone = pickByLabel(p.Phone, ["Business", "Business Mobile", "Private", "Private Mobile"]);
          const previewMail = pickByLabel(p.Mail, ["Business", "Private", "Other"]);
          const webexMail =
            p.WebexEmail ||
            pickByLabel(p.Mail, ["Business", "Other", "Private"])?.Address ||
            null;
          const webexLink = p.WebexEnabled && webexMail ? `webexteams://im?email=${encodeURIComponent(webexMail)}` : null;
          const sekretariatPreview = formatSecretariatPreview(p.Secretariats);
          const orgPreview = formatOrgPreview(p.Organizations);

          return (
            <details
              key={p.id}
              className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(15,23,42,0.12)]"
            >
              <summary className="grid cursor-pointer list-none gap-3 p-4 marker:content-none [&::-webkit-details-marker]:hidden md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="grid justify-self-start grid-cols-[auto_1fr] items-center gap-[14px]">
                  <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-[var(--card-border)] bg-[#f2f3f5]">
                    {pic ? (
                      <Image
                        src={pic}
                        alt={alt}
                        width={56}
                        height={56}
                        sizes="56px"
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="text-[20px] font-bold text-[var(--accent)]">{fmtName(p)[0]}</div>
                    )}
                  </div>
                  <div className="grid gap-1">
                    <div className="text-[1.05rem] font-bold text-[var(--ink)]">{highlightText(fmtName(p), q)}</div>
                    <div className="text-[0.9rem] text-[var(--ink-soft)]">
                      {previewPhone?.Number ? (
                        <>
                          📞 {highlightText(previewPhone.Number, q)}
                        </>
                      ) : (
                        "keine Nummer"
                      )}{" "}
                      ·{" "}
                      {previewMail?.Address ? <>✉️ {highlightText(previewMail.Address, q)}</> : "keine E‑Mail"} ·{" "}
                      {(p.Address || []).length ? `${(p.Address || []).length} Adresse` : "keine Adressen"}
                      {webexLink ? <> · 💬 Webex</> : null}
                    </div>
                    {sekretariatPreview ? (
                      <div className="mt-0.5 text-[0.85rem] text-[var(--ink-soft)]">Sekretariat: {sekretariatPreview}</div>
                    ) : null}
                    {orgPreview ? (
                      <div className="mt-0.5 text-[0.85rem] text-[var(--ink-soft)]">Organisation: {highlightText(orgPreview, q)}</div>
                    ) : null}
                  </div>
                </div>
                <div className="w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[0.85rem] font-semibold tracking-[0.01em] text-[var(--accent)]">
                  Details
                </div>
              </summary>

              <div className="border-t border-[var(--card-border)] bg-[#fbfbfc] px-4 pb-[18px] pt-[10px]">
                <div className="mb-[14px] grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                  <section>
                    <h4 className="mb-2 mt-1 text-[0.9rem] tracking-[0.04em] text-[var(--muted)]">💬 Chat</h4>
                    {webexLink ? (
                      <ul className="m-0 list-disc pl-[18px]">
                        <li className="text-[#2f3640]">
                          <a className="text-[var(--accent)] no-underline hover:underline" href={webexLink}>
                            Webex-Chat öffnen
                          </a>
                        </li>
                      </ul>
                    ) : (
                      <div className="opacity-60">Kein Webex hinterlegt</div>
                    )}
                  </section>

                  <section>
                    <h4 className="mb-2 mt-1 text-[0.9rem] tracking-[0.04em] text-[var(--muted)]">📞 Telefon</h4>
                    {(p.Phone || []).length ? (
                      <ul className="m-0 list-disc pl-[18px]">
                        {(p.Phone || []).map((ph, idx) => {
                          const label = formatContactLabel(ph?.Label, "Telefon");
                          const number = ph?.Number || "";
                          const telHref = number ? `tel:${number.replace(/\s/g, "")}` : "#";
                          return (
                            <li key={idx} className="mb-1.5 text-[#2f3640]">
                              <span className="text-[var(--muted)]">{label}:</span>{" "}
                              {number ? (
                                <a className="text-[var(--accent)] no-underline hover:underline" href={telHref}>
                                  {highlightText(number, q)}
                                </a>
                              ) : (
                                <em>—</em>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="opacity-60">Keine Nummern</div>
                    )}
                  </section>

                  <section>
                    <h4 className="mb-2 mt-1 text-[0.9rem] tracking-[0.04em] text-[var(--muted)]">✉️ E‑Mail</h4>
                    {(p.Mail || []).length ? (
                      <ul className="m-0 list-disc pl-[18px]">
                        {(p.Mail || []).map((m, idx) => {
                          const label = formatContactLabel(m?.Label, "E-Mail");
                          const addr = m?.Address || "";
                          const mailHref = addr ? `mailto:${addr}` : "#";
                          return (
                            <li key={idx} className="mb-1.5 text-[#2f3640]">
                              <span className="text-[var(--muted)]">{label}:</span>{" "}
                              {addr ? (
                                <a className="text-[var(--accent)] no-underline hover:underline" href={mailHref}>
                                  {addr}
                                </a>
                              ) : (
                                <em>—</em>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="opacity-60">Keine E‑Mails</div>
                    )}
                  </section>

                  <section>
                    <h4 className="mb-2 mt-1 text-[0.9rem] tracking-[0.04em] text-[var(--muted)]">🏠 Adresse</h4>
                    {(p.Address || []).length ? (
                      <ul className="m-0 list-disc pl-[18px]">
                        {(p.Address || []).map((a, idx) => {
                          const label = a?.Label || "Adresse";
                          const text = fmtAddress(a);
                          return (
                            <li key={idx} className="mb-1.5 text-[#2f3640]">
                              <span className="text-[var(--muted)]">{label}:</span> {text ? <span>{text}</span> : <em>—</em>}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="opacity-60">Keine Adressen</div>
                    )}
                  </section>
                </div>

                <div className="grid gap-4 border-t border-dashed border-[var(--card-border)] pt-[10px] md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                  {(p.Secretariats || []).length ? (
                    <section>
                      <h4 className="mb-2 mt-1 text-[0.9rem] tracking-[0.04em] text-[var(--muted)]">🧑‍💼 Sekretariat</h4>
                      <div className="grid gap-2">
                        {(p.Secretariats || []).map((s, idx) => {
                          const secMails = (s.Mail || []).filter((m) => m?.Address);
                          const secPhones = (s.Phones || []).filter((ph) => ph?.Number);
                          const cardMail = s.Email || secMails[0]?.Address || null;
                          const cardPhone = s.Phone || secPhones[0]?.Number || null;
                          const addresses = (s.Address || []).map((a) => fmtAddress(a)).filter(Boolean);
                          const orgs = (s.Organizations || [])
                            .map((o) => o.Name || o.ShortName)
                            .filter(Boolean)
                            .join(", ");

                          return (
                            <article
                              className="rounded-[10px] border border-[var(--card-border)] bg-white px-[10px] py-2"
                              key={s.documentId || s.id || idx}
                            >
                              <div className="mb-1 font-[650]">{s.Name || "(ohne Namen)"}</div>
                              <div className="grid gap-[3px] text-[0.9rem] text-[var(--ink-soft)]">
                                {cardMail ? (
                                  <div>
                                    <span className="text-[var(--muted)]">E‑Mail:</span>{" "}
                                    <a className="text-[var(--accent)] no-underline hover:underline" href={`mailto:${cardMail}`}>
                                      {cardMail}
                                    </a>
                                  </div>
                                ) : null}
                                {secMails.slice(1).map((m, i) => (
                                  <div key={`mail-${i}`}>
                                    <span className="text-[var(--muted)]">{formatContactLabel(m?.Label, "E‑Mail")}:</span>{" "}
                                    <a className="text-[var(--accent)] no-underline hover:underline" href={`mailto:${m?.Address}`}>
                                      {m?.Address}
                                    </a>
                                  </div>
                                ))}
                                {cardPhone ? (
                                  <div>
                                    <span className="text-[var(--muted)]">Telefon:</span>{" "}
                                    <a className="text-[var(--accent)] no-underline hover:underline" href={`tel:${cardPhone.replace(/\s/g, "")}`}>
                                      {cardPhone}
                                    </a>
                                  </div>
                                ) : null}
                                {secPhones
                                  .filter((ph) => ph?.Number !== cardPhone)
                                  .map((ph, i) => (
                                    <div key={`phone-${i}`}>
                                      <span className="text-[var(--muted)]">{formatContactLabel(ph?.Label, "Telefon")}:</span>{" "}
                                      <a
                                        className="text-[var(--accent)] no-underline hover:underline"
                                        href={`tel:${(ph?.Number || "").replace(/\s/g, "")}`}
                                      >
                                        {ph?.Number}
                                      </a>
                                    </div>
                                  ))}
                                {orgs ? (
                                  <div>
                                    <span className="text-[var(--muted)]">Organisation:</span> {orgs}
                                  </div>
                                ) : null}
                                {addresses[0] ? (
                                  <div>
                                    <span className="text-[var(--muted)]">Adresse:</span> {addresses[0]}
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  <section>
                    <h4 className="mb-2 mt-1 text-[0.9rem] tracking-[0.04em] text-[var(--muted)]">🏢 Organisation</h4>
                    {(p.Organizations || []).length ? (
                      <ul className="m-0 list-disc pl-[18px]">
                        {(p.Organizations || []).map((o, idx) => {
                          const isLeadership = Boolean((o.LeadershipRoles || []).length) || Boolean(o.LeadershipPrimary);
                          return (
                            <li key={o.documentId || o.id || idx} className="mb-1.5 text-[#2f3640]">
                              <span className="text-[#2f3640]">
                                {o.Name || o.ShortName || "(ohne Name)"}
                                {isLeadership ? " (Leitung)" : ""}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="opacity-60">Keine Organisation hinterlegt</div>
                    )}
                  </section>
                </div>

                {p.documentId ? (
                  <div className="mt-[14px] flex justify-end max-sm:justify-start">
                    <Link
                      href={`/contact/${p.documentId}`}
                      className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#d4ddd9] bg-white px-3 py-2 font-semibold text-[var(--ink)] no-underline hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      Profil öffnen
                    </Link>
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>

      {pagination ? (
        <div className="mx-auto mt-[22px] inline-flex flex-wrap items-center justify-center gap-2 rounded-[14px] border border-[var(--card-border)] bg-white p-2 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
          <button
            className="cursor-pointer rounded-[10px] border border-[#dfe2e7] bg-white px-3 py-2 font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setPage(1)}
            disabled={pagination.page <= 1 || loading}
          >
            « Erste
          </button>
          <button
            className="cursor-pointer rounded-[10px] border border-[#dfe2e7] bg-white px-3 py-2 font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page <= 1 || loading}
          >
            ‹ Zurück
          </button>
          <div className="whitespace-nowrap px-1.5 text-[0.95rem] text-[var(--ink-soft)]">
            Seite {pagination.page}
            {pagination.pageCount ? ` von ${pagination.pageCount}` : ""}
          </div>
          <button
            className="cursor-pointer rounded-[10px] border border-[#dfe2e7] bg-white px-3 py-2 font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setPage((p) => p + 1)}
            disabled={pagination.pageCount ? pagination.page >= pagination.pageCount : loading}
          >
            Weiter ›
          </button>
          <button
            className="cursor-pointer rounded-[10px] border border-[#dfe2e7] bg-white px-3 py-2 font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => pagination.pageCount && setPage(pagination.pageCount)}
            disabled={!pagination.pageCount || pagination.page >= pagination.pageCount || loading}
          >
            Letzte »
          </button>
        </div>
      ) : null}
    </section>
  );
}
