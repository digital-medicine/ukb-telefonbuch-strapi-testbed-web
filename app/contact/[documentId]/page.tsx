import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import EditLinkButton from "./EditLinkButton";
import { fetchPersonByDocumentId, findBusinessMail, formatPersonName } from "@/lib/people";

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

function publicationMeta(pub: {
  PublishedDate?: string | null;
  Journal?: string | null;
}) {
  const year = pub.PublishedDate?.slice(0, 4) || "";
  return [year, pub.Journal].filter(Boolean).join(" · ");
}

function primarySecretariatContact(secretariat: {
  Email?: string | null;
  Phone?: string | null;
  Mail?: Array<{ Address?: string | null }> | null;
  Phones?: Array<{ Number?: string | null }> | null;
}) {
  const email = secretariat.Email || secretariat.Mail?.find((entry) => entry?.Address)?.Address || null;
  const phone = secretariat.Phone || secretariat.Phones?.find((entry) => entry?.Number)?.Number || null;
  return { email, phone };
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const person = await fetchPersonByDocumentId(documentId);
  if (!person) notFound();

  const photo =
    person.EmployeePicture?.formats?.small?.url ||
    person.EmployeePicture?.formats?.thumbnail?.url ||
    person.EmployeePicture?.url ||
    null;
  const businessMail = findBusinessMail(person);
  const primaryOrganization =
    (person.Organizations || []).find((org) => org.AffiliationPrimary) ||
    (person.Organizations || [])[0] ||
    null;
  const publicationCount = person.Publications?.length || 0;
  const addressCount = person.Address?.length || 0;
  const mailCount = person.Mail?.length || 0;
  const phoneCount = person.Phone?.length || 0;
  const businessPhone =
    (person.Phone || []).find((entry) => ["business", "business mobile"].includes((entry.Label || "").toLowerCase()))?.Number;

  return (
    <main className="mx-auto max-w-[1120px] px-6 pb-14 pt-8 text-[var(--ink)]">
      <div className="mb-6 grid gap-3">
        <Link
          href="/"
          className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-[rgba(255,255,255,0.8)] px-3 py-2 font-semibold text-[var(--ink)] no-underline backdrop-blur-[8px] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Zurück zum Telefonbuch
        </Link>
        <h1 className="m-0 text-[clamp(2rem,3vw,2.8rem)] tracking-[-0.02em] text-[#111318]">{formatPersonName(person)}</h1>
        <p className="m-0 max-w-[60ch] text-[#4a4f5c]">
          Kontaktdetails, Organisationen und Publikationen für diesen Eintrag.
        </p>
      </div>

      <section className="mb-[22px]">
        <div className="grid gap-7 rounded-[24px] border border-[var(--card-border)] bg-[radial-gradient(120%_140%_at_0%_0%,rgba(223,238,233,0.85),transparent_45%),radial-gradient(90%_120%_at_100%_0%,rgba(231,238,246,0.9),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.97),rgba(247,249,252,0.97))] p-7 text-[#111318] shadow-[0_22px_44px_rgba(15,23,42,0.08)] md:grid-cols-[280px_1fr]">
          <div className="grid h-[320px] w-[280px] place-items-center overflow-hidden rounded-[22px] border border-[var(--card-border)] bg-[linear-gradient(180deg,#eef2f4,#e5eaee)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] max-md:h-[220px] max-md:w-[180px]">
            {photo ? (
              <Image
                src={photo}
                alt={person.EmployeePicture?.alternativeText || formatPersonName(person)}
                width={280}
                height={320}
                sizes="(max-width: 900px) 100vw, 280px"
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="text-[4rem] font-bold text-[var(--accent)]">{formatPersonName(person).charAt(0)}</div>
            )}
          </div>

          <div className="grid content-start gap-[18px] text-[#111318]">
            <div className="grid gap-1.5">
              <h2 className="m-0 text-[clamp(1.8rem,2.5vw,2.3rem)] tracking-[-0.02em] text-[#111318]">{formatPersonName(person)}</h2>
              {primaryOrganization ? (
                <p className="m-0 text-base font-bold text-[#1f6f5b]">{primaryOrganization.ShortName || primaryOrganization.Name}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2.5">
              {businessMail ? <span className="inline-flex items-center rounded-full border border-[#dce4e1] bg-[rgba(255,255,255,0.9)] px-[10px] py-[7px] text-[0.88rem] font-semibold text-[#2f3640]">✉️ Business-Mail vorhanden</span> : null}
              {businessPhone ? <span className="inline-flex items-center rounded-full border border-[#dce4e1] bg-[rgba(255,255,255,0.9)] px-[10px] py-[7px] text-[0.88rem] font-semibold text-[#2f3640]">📞 Business-Telefon vorhanden</span> : null}
              {phoneCount ? <span className="inline-flex items-center rounded-full border border-[#dce4e1] bg-[rgba(255,255,255,0.9)] px-[10px] py-[7px] text-[0.88rem] font-semibold text-[#2f3640]">{phoneCount} Telefonnummern</span> : null}
              {mailCount ? <span className="inline-flex items-center rounded-full border border-[#dce4e1] bg-[rgba(255,255,255,0.9)] px-[10px] py-[7px] text-[0.88rem] font-semibold text-[#2f3640]">{mailCount} E-Mail-Adressen</span> : null}
              {publicationCount ? <span className="inline-flex items-center rounded-full border border-[#dce4e1] bg-[rgba(255,255,255,0.9)] px-[10px] py-[7px] text-[0.88rem] font-semibold text-[#2f3640]">{publicationCount} Publikationen</span> : null}
              {addressCount ? <span className="inline-flex items-center rounded-full border border-[#dce4e1] bg-[rgba(255,255,255,0.9)] px-[10px] py-[7px] text-[0.88rem] font-semibold text-[#2f3640]">{addressCount} Adressen</span> : null}
            </div>

            {businessMail ? <div className="flex items-start"><EditLinkButton documentId={documentId} /></div> : null}
          </div>
        </div>
      </section>

      {(person.Secretariats || []).length ? (
        <section className="mb-[18px]">
          <div className="rounded-[18px] border border-[var(--card-border)] bg-[linear-gradient(180deg,#ffffff,#fcfcfd)] p-5 text-[#111318] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-[14px] grid gap-1">
              <h3 className="m-0 text-[1.02rem] tracking-[-0.01em] text-[#111318]">🧑‍💼 Sekretariat</h3>
              <p className="m-0 text-[0.92rem] text-[#66707f]">Kontaktpunkte und zugehörige Organisationen des Sekretariats.</p>
            </div>
            <div className="grid gap-3">
              {(person.Secretariats || []).map((secretariat, index) => {
                const contact = primarySecretariatContact(secretariat);
                return (
                  <article key={`${secretariat.documentId || secretariat.id || index}`} className="grid gap-2 rounded-[14px] border border-[#e6eaef] bg-[linear-gradient(180deg,#fdfefe,#f7fafb)] px-4 py-[14px]">
                    <div className="text-[0.9rem] font-bold uppercase tracking-[0.04em] text-[#5f6675]">{secretariat.Name || "(ohne Namen)"}</div>
                    <div className="grid gap-1 text-[#2f3640]">
                      {contact.email ? (
                        <div className="break-words">
                          <a className="text-[#0f5d61] no-underline hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a>
                        </div>
                      ) : null}
                      {contact.phone ? (
                        <div>
                          <a className="text-[#0f5d61] no-underline hover:underline" href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>
                        </div>
                      ) : null}
                      {(secretariat.Organizations || []).length ? (
                        <div>{(secretariat.Organizations || []).map((org) => org.ShortName || org.Name).filter(Boolean).join(", ")}</div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-[18px]">
        <div className="rounded-[18px] border border-[var(--card-border)] bg-[linear-gradient(180deg,#ffffff,#fcfcfd)] p-5 text-[#111318] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="mb-[14px] grid gap-1">
            <h3 className="m-0 text-[1.02rem] tracking-[-0.01em] text-[#111318]">📞 Telefon</h3>
            <p className="m-0 text-[0.92rem] text-[#66707f]">Alle hinterlegten Rufnummern dieser Person.</p>
          </div>
          {(person.Phone || []).length ? (
            <div className="grid gap-3">
              {(person.Phone || []).map((entry, index) => (
                <article key={`${entry.Label || "phone"}-${index}`} className="grid gap-2 rounded-[14px] border border-[#e6eaef] bg-[linear-gradient(180deg,#fdfefe,#f7fafb)] px-4 py-[14px]">
                  <div className="text-[0.9rem] font-bold uppercase tracking-[0.04em] text-[#5f6675]">{formatContactLabel(entry.Label, "Telefon")}</div>
                  <div className="grid gap-1 text-[#2f3640]">
                    {entry.Number ? <a className="text-[#0f5d61] no-underline hover:underline" href={`tel:${entry.Number.replace(/\s/g, "")}`}>{entry.Number}</a> : "—"}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-[#4a4f5c]">Keine Nummern hinterlegt.</p>
          )}
        </div>
      </section>

      <section className="mb-[18px]">
        <div className="rounded-[18px] border border-[var(--card-border)] bg-[linear-gradient(180deg,#ffffff,#fcfcfd)] p-5 text-[#111318] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="mb-[14px] grid gap-1">
            <h3 className="m-0 text-[1.02rem] tracking-[-0.01em] text-[#111318]">✉️ E-Mail</h3>
            <p className="m-0 text-[0.92rem] text-[#66707f]">Direkte Kontaktadressen mit Mail-Links.</p>
          </div>
          {(person.Mail || []).length ? (
            <div className="grid gap-3">
              {(person.Mail || []).map((entry, index) => (
                <article key={`${entry.Label || "mail"}-${index}`} className="grid gap-2 rounded-[14px] border border-[#e6eaef] bg-[linear-gradient(180deg,#fdfefe,#f7fafb)] px-4 py-[14px]">
                  <div className="text-[0.9rem] font-bold uppercase tracking-[0.04em] text-[#5f6675]">{formatContactLabel(entry.Label, "E-Mail")}</div>
                  <div className="grid gap-1 break-words text-[#2f3640]">
                    {entry.Address ? <a className="break-words text-[#0f5d61] no-underline hover:underline" href={`mailto:${entry.Address}`}>{entry.Address}</a> : "—"}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-[#4a4f5c]">Keine E-Mails hinterlegt.</p>
          )}
        </div>
      </section>

      <section className="mb-[18px]">
        <div className="rounded-[18px] border border-[var(--card-border)] bg-[linear-gradient(180deg,#ffffff,#fcfcfd)] p-5 text-[#111318] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="mb-[14px] grid gap-1">
            <h3 className="m-0 text-[1.02rem] tracking-[-0.01em] text-[#111318]">🏠 Adressen</h3>
            <p className="m-0 text-[0.92rem] text-[#66707f]">Postadressen in vollständiger, lesbarer Darstellung.</p>
          </div>
          {(person.Address || []).length ? (
            <div className="grid gap-3">
              {(person.Address || []).map((entry, index) => (
                <article key={`${entry.Label || "address"}-${index}`} className="grid gap-2 rounded-[14px] border border-[#e6eaef] bg-[linear-gradient(180deg,#fdfefe,#f7fafb)] px-4 py-[14px]">
                  <div className="text-[0.9rem] font-bold uppercase tracking-[0.04em] text-[#5f6675]">{entry.Label || "Adresse"}</div>
                  <div className="grid gap-0.5 text-[#2f3640]">
                    <div>{[entry.StreetName, entry.StreetNumber].filter(Boolean).join(" ").trim() || "—"}</div>
                    <div>{[entry.Zip, entry.City].filter(Boolean).join(" ").trim() || null}</div>
                    <div>{[entry.State, entry.Country].filter(Boolean).join(", ").trim() || null}</div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-[#4a4f5c]">Keine Adressen hinterlegt.</p>
          )}
        </div>
      </section>

      <section className="mb-[18px]">
        <div className="rounded-[18px] border border-[var(--card-border)] bg-[linear-gradient(180deg,#ffffff,#fcfcfd)] p-5 text-[#111318] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="mb-[14px] grid gap-1">
            <h3 className="m-0 text-[1.02rem] tracking-[-0.01em] text-[#111318]">🏢 Organisationen</h3>
            <p className="m-0 text-[0.92rem] text-[#66707f]">Zuordnungen, Primärorganisation und Leitungsfunktionen.</p>
          </div>
          {(person.Organizations || []).length ? (
            <ul className="grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
              {(person.Organizations || []).map((org, index) => (
                <li key={`${org.documentId || org.id || index}`} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[#e6eaef] bg-[linear-gradient(180deg,#fbfcfd,#f6f8fa)] px-[14px] py-3">
                  <span className="font-semibold text-[#111318]">{org.Name || org.ShortName || "(ohne Name)"}</span>
                  {org.AffiliationPrimary ? <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[0.78rem] font-bold text-[var(--accent)]">Primär</span> : null}
                  {org.LeadershipPrimary || (org.LeadershipRoles || []).length ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[0.78rem] font-bold text-[var(--accent)]">Leitung</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#4a4f5c]">Keine Organisationen hinterlegt.</p>
          )}
        </div>
      </section>

      {(person.Publications || []).length ? (
        <section className="mb-[18px]">
          <div className="rounded-[18px] border border-[var(--card-border)] bg-[linear-gradient(180deg,#ffffff,#fcfcfd)] p-[18px] text-[#111318] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-[14px] grid gap-1">
              <h3 className="m-0 text-[1.02rem] tracking-[-0.01em] text-[#111318]">📚 Publikationen</h3>
              <p className="m-0 text-[0.92rem] text-[#66707f]">Verknüpfte Veröffentlichungen mit externem Link.</p>
            </div>
            <div className="grid gap-2.5">
              {(person.Publications || []).map((link) => {
                const pub = link.Publication;
                if (!pub) return null;
                const href = pub.URL || (pub.DOI ? `https://doi.org/${pub.DOI}` : null);
                return (
                  <article className="grid gap-2 rounded-[14px] border border-[#e6eaef] bg-[linear-gradient(180deg,#fbfcfd,#f7f9fb)] px-4 py-[14px]" key={`${link.id || pub.id}`}>
                    <div className="font-[650]">{pub.Title || "Ohne Titel"}</div>
                    <div className="text-[0.9rem] text-[var(--muted)]">{publicationMeta(pub)}</div>
                    <div className="flex items-center gap-2.5 text-[0.9rem]">
                      {href ? (
                        <a className="font-semibold text-[var(--ink)] no-underline hover:text-[var(--accent)]" href={href} target="_blank" rel="noreferrer">
                          Öffnen
                        </a>
                      ) : (
                        <span className="opacity-60">Kein Link</span>
                      )}
                      {pub.Type ? <span className="rounded-full bg-[#f1f4f5] px-2 py-0.5 text-[0.8rem] text-[#3d4c52]">{pub.Type}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
