/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

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

function yearFromDate(d?: string | null) {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})/);
  return m ? m[1] : null;
}

function pickByLabel<T extends { Label?: string | null }>(
  items: T[] | null | undefined,
  preferred: string[]
) {
  const list = items || [];
  if (!list.length) return null;
  for (const pref of preferred) {
    const found = list.find((it) => (it?.Label || "").toLowerCase() === pref);
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
    <section className="directory">
      <div className="directory-toolbar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nach Name suchen…"
          className="directory-search"
        />

        <label className="directory-label">
          Sort:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="directory-select">
            <option value="Lastname">Nachname</option>
            <option value="Firstname">Vorname</option>
          </select>
        </label>

        <label className="directory-label">
          Richtung:
          <select value={dir} onChange={(e) => setDir(e.target.value as any)} className="directory-select">
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
        </label>

        <label className="directory-label">
          Phone-Label:
          <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="directory-select">
            <option value="">(alle)</option>
            {labelOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <div className="directory-count">
          {loading
            ? "Lade…"
            : pagination?.total
              ? `${pagination.total} Einträge`
              : `${items.length} Einträge`}
        </div>
      </div>

      {err ? (
        <div className="directory-error">Fehler: {err}</div>
      ) : null}

      <div className="directory-grid">
        {items.map((p) => {
          const pic =
            p.EmployeePicture?.formats?.small?.url ||
            p.EmployeePicture?.formats?.thumbnail?.url ||
            p.EmployeePicture?.url ||
            null;
          const alt = p.EmployeePicture?.alternativeText || fmtName(p);
          const previewPhone = pickByLabel(p.Phone, ["business", "privat", "private"]);
          const previewMail = pickByLabel(p.Mail, ["business", "privat", "private"]);
          const webexMail =
            p.WebexEmail ||
            pickByLabel(p.Mail, ["business", "other", "private", "privat"])?.Address ||
            null;
          const webexLink = p.WebexEnabled && webexMail ? `webexteams://im?email=${encodeURIComponent(webexMail)}` : null;
          const sekretariatPreview = formatSecretariatPreview(p.Secretariats);
          const orgPreview = formatOrgPreview(p.Organizations);

          return (
            <details key={p.id} className="person-card">
              <summary className="person-summary">
                <div className="person-head">
                  <div className="person-avatar">
                    {pic ? <img src={pic} alt={alt} /> : <div className="person-avatar-fallback">{fmtName(p)[0]}</div>}
                  </div>
                  <div className="person-title">
                    <div className="person-name">{fmtName(p)}</div>
                    <div className="person-meta">
                      {previewPhone?.Number ? `📞 ${previewPhone.Number}` : "keine Nummer"} ·{" "}
                      {previewMail?.Address ? `✉️ ${previewMail.Address}` : "keine E‑Mail"} ·{" "}
                      {(p.Address || []).length ? `${(p.Address || []).length} Adresse` : "keine Adressen"}
                      {webexLink ? <> · 💬 Webex</> : null}
                    </div>
                    {sekretariatPreview ? (
                      <div className="person-meta person-meta-extra">Sekretariat: {sekretariatPreview}</div>
                    ) : null}
                    {orgPreview ? (
                      <div className="person-meta person-meta-extra">Organisation: {orgPreview}</div>
                    ) : null}
                  </div>
                </div>
                <div className="person-toggle">Details</div>
              </summary>

              <div className="person-body">
                {p.documentId ? (
                  <div className="person-actions">
                    <Link href={`/contact/${p.documentId}`} className="person-link-button">
                      Profil oeffnen
                    </Link>
                  </div>
                ) : null}

                <div className="person-section-grid">
                  <section className="person-section">
                    <h4>💬 Chat</h4>
                    {webexLink ? (
                      <ul>
                        <li>
                          <a href={webexLink}>Webex-Chat öffnen</a>
                        </li>
                      </ul>
                    ) : (
                      <div className="empty">Kein Webex hinterlegt</div>
                    )}
                  </section>

                  <section className="person-section">
                    <h4>📞 Telefon</h4>
                    {(p.Phone || []).length ? (
                      <ul>
                        {(p.Phone || []).map((ph, idx) => {
                          const label = ph?.Label || "phone";
                          const number = ph?.Number || "";
                          const telHref = number ? `tel:${number.replace(/\s/g, "")}` : "#";
                          return (
                            <li key={idx}>
                              <span>{label}:</span>{" "}
                              {number ? <a href={telHref}>{number}</a> : <em>—</em>}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="empty">Keine Nummern</div>
                    )}
                  </section>

                  <section className="person-section">
                    <h4>✉️ E‑Mail</h4>
                    {(p.Mail || []).length ? (
                      <ul>
                        {(p.Mail || []).map((m, idx) => {
                          const label = m?.Label || "mail";
                          const addr = m?.Address || "";
                          const mailHref = addr ? `mailto:${addr}` : "#";
                          return (
                            <li key={idx}>
                              <span>{label}:</span>{" "}
                              {addr ? <a href={mailHref}>{addr}</a> : <em>—</em>}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="empty">Keine E‑Mails</div>
                    )}
                  </section>

                  <section className="person-section">
                    <h4>🏠 Adresse</h4>
                    {(p.Address || []).length ? (
                      <ul>
                        {(p.Address || []).map((a, idx) => {
                          const label = a?.Label || "Adresse";
                          const text = fmtAddress(a);
                          return (
                            <li key={idx}>
                              <span>{label}:</span> {text ? <span>{text}</span> : <em>—</em>}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="empty">Keine Adressen</div>
                    )}
                  </section>
                </div>

                <div className="person-section-grid person-section-grid-extra">
                  {(p.Secretariats || []).length ? (
                    <section className="person-section">
                      <h4>🧑‍💼 Sekretariat</h4>
                      <div className="secretariat-list">
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
                            <article className="secretariat-card" key={s.documentId || s.id || idx}>
                              <div className="secretariat-name">{s.Name || "(ohne Namen)"}</div>
                              <div className="secretariat-lines">
                                {cardMail ? (
                                  <div>
                                    <span>E‑Mail:</span> <a href={`mailto:${cardMail}`}>{cardMail}</a>
                                  </div>
                                ) : null}
                                {secMails.slice(1).map((m, i) => (
                                  <div key={`mail-${i}`}>
                                    <span>{m?.Label || "E‑Mail"}:</span>{" "}
                                    <a href={`mailto:${m?.Address}`}>{m?.Address}</a>
                                  </div>
                                ))}
                                {cardPhone ? (
                                  <div>
                                    <span>Telefon:</span>{" "}
                                    <a href={`tel:${cardPhone.replace(/\s/g, "")}`}>{cardPhone}</a>
                                  </div>
                                ) : null}
                                {secPhones
                                  .filter((ph) => ph?.Number !== cardPhone)
                                  .map((ph, i) => (
                                    <div key={`phone-${i}`}>
                                      <span>{ph?.Label || "Telefon"}:</span>{" "}
                                      <a href={`tel:${(ph?.Number || "").replace(/\s/g, "")}`}>{ph?.Number}</a>
                                    </div>
                                  ))}
                                {orgs ? (
                                  <div>
                                    <span>Organisation:</span> {orgs}
                                  </div>
                                ) : null}
                                {addresses[0] ? (
                                  <div>
                                    <span>Adresse:</span> {addresses[0]}
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  <section className="person-section">
                    <h4>🏢 Organisation</h4>
                    {(p.Organizations || []).length ? (
                      <ul>
                        {(p.Organizations || []).map((o, idx) => {
                          const isLeadership = Boolean((o.LeadershipRoles || []).length) || Boolean(o.LeadershipPrimary);
                          return (
                            <li key={o.documentId || o.id || idx}>
                              <span>
                                {o.Name || o.ShortName || "(ohne Name)"}
                                {isLeadership ? " (Leitung)" : ""}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="empty">Keine Organisation hinterlegt</div>
                    )}
                  </section>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      {pagination ? (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setPage(1)}
            disabled={pagination.page <= 1 || loading}
          >
            « Erste
          </button>
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page <= 1 || loading}
          >
            ‹ Zurück
          </button>
          <div className="pagination-info">
            Seite {pagination.page}
            {pagination.pageCount ? ` von ${pagination.pageCount}` : ""}
          </div>
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={pagination.pageCount ? pagination.page >= pagination.pageCount : loading}
          >
            Weiter ›
          </button>
          <button
            className="pagination-btn"
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
