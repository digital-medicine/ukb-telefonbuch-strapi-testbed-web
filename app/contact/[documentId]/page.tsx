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
  const businessPhone =
    (person.Phone || []).find((entry) => ["business", "business mobile"].includes((entry.Label || "").toLowerCase()))?.Number;

  return (
    <main className="person-page">
      <div className="person-page-header">
        <Link href="/" className="back-link">
          Zurück zum Telefonbuch
        </Link>
        <h1 className="person-page-title">{formatPersonName(person)}</h1>
        <p className="person-page-subtitle">
          Kontaktdetails, Organisationen und Publikationen für diesen Eintrag.
        </p>
      </div>

      <section className="person-hero">
        <div className="person-hero-card">
          <div className="person-hero-media">
            {photo ? (
              <img src={photo} alt={person.EmployeePicture?.alternativeText || formatPersonName(person)} />
            ) : (
              <div className="person-hero-fallback">{formatPersonName(person).charAt(0)}</div>
            )}
          </div>

          <div className="person-hero-content">
            <div className="person-hero-title-block">
              <h2>{formatPersonName(person)}</h2>
              {primaryOrganization ? (
                <p className="person-hero-role">{primaryOrganization.ShortName || primaryOrganization.Name}</p>
              ) : null}
              {person.MailIdentifier ? <p className="person-hero-id">{person.MailIdentifier}</p> : null}
            </div>

            <div className="person-hero-facts">
              {businessMail ? <span className="person-fact">Business-Mail vorhanden</span> : null}
              {businessPhone ? <span className="person-fact">Business-Telefon vorhanden</span> : null}
              {publicationCount ? <span className="person-fact">{publicationCount} Publikationen</span> : null}
              {addressCount ? <span className="person-fact">{addressCount} Adressen</span> : null}
            </div>

            {businessMail ? <EditLinkButton documentId={documentId} /> : null}
          </div>
        </div>
      </section>

      {(person.Secretariats || []).length ? (
        <section className="person-detail-section">
          <div className="person-detail-card person-detail-card-wide">
            <h3>🧑‍💼 Sekretariat</h3>
            <div className="contact-block-list">
              {(person.Secretariats || []).map((secretariat, index) => {
                const contact = primarySecretariatContact(secretariat);
                return (
                  <article key={`${secretariat.documentId || secretariat.id || index}`} className="contact-block-item">
                    <div className="contact-block-label">{secretariat.Name || "(ohne Namen)"}</div>
                    <div className="contact-block-value">
                      {contact.email ? (
                        <div className="contact-block-break">
                          <a href={`mailto:${contact.email}`}>{contact.email}</a>
                        </div>
                      ) : null}
                      {contact.phone ? (
                        <div>
                          <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>
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

      <section className="person-detail-section">
        <div className="person-detail-card person-detail-card-wide">
          <h3>📞 Telefon</h3>
          {(person.Phone || []).length ? (
            <div className="contact-block-list">
              {(person.Phone || []).map((entry, index) => (
                <article key={`${entry.Label || "phone"}-${index}`} className="contact-block-item">
                  <div className="contact-block-label">{formatContactLabel(entry.Label, "Telefon")}</div>
                  <div className="contact-block-value">
                    {entry.Number ? <a href={`tel:${entry.Number.replace(/\s/g, "")}`}>{entry.Number}</a> : "—"}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty">Keine Nummern hinterlegt.</p>
          )}
        </div>
      </section>

      <section className="person-detail-section">
        <div className="person-detail-card person-detail-card-wide">
          <h3>✉️ E-Mail</h3>
          {(person.Mail || []).length ? (
            <div className="contact-block-list">
              {(person.Mail || []).map((entry, index) => (
                <article key={`${entry.Label || "mail"}-${index}`} className="contact-block-item">
                  <div className="contact-block-label">{formatContactLabel(entry.Label, "E-Mail")}</div>
                  <div className="contact-block-value contact-block-break">
                    {entry.Address ? <a href={`mailto:${entry.Address}`}>{entry.Address}</a> : "—"}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty">Keine E-Mails hinterlegt.</p>
          )}
        </div>
      </section>

      <section className="person-detail-section">
        <div className="person-detail-card person-detail-card-wide">
          <h3>🏠 Adressen</h3>
          {(person.Address || []).length ? (
            <div className="contact-block-list">
              {(person.Address || []).map((entry, index) => (
                <article key={`${entry.Label || "address"}-${index}`} className="contact-block-item">
                  <div className="contact-block-label">{entry.Label || "Adresse"}</div>
                  <div className="contact-block-value contact-block-address">
                    <div>{[entry.StreetName, entry.StreetNumber].filter(Boolean).join(" ").trim() || "—"}</div>
                    <div>{[entry.Zip, entry.City].filter(Boolean).join(" ").trim() || null}</div>
                    <div>{[entry.State, entry.Country].filter(Boolean).join(", ").trim() || null}</div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty">Keine Adressen hinterlegt.</p>
          )}
        </div>
      </section>

      <section className="person-detail-section">
        <div className="person-detail-card person-detail-card-wide">
          <h3>🏢 Organisationen</h3>
          {(person.Organizations || []).length ? (
            <ul className="organization-list">
              {(person.Organizations || []).map((org, index) => (
                <li key={`${org.documentId || org.id || index}`} className="organization-item">
                  <span className="organization-name">{org.Name || org.ShortName || "(ohne Name)"}</span>
                  {org.AffiliationPrimary ? <span className="organization-badge">Primär</span> : null}
                  {org.LeadershipPrimary || (org.LeadershipRoles || []).length ? (
                    <span className="organization-badge">Leitung</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Keine Organisationen hinterlegt.</p>
          )}
        </div>
      </section>

      {(person.Publications || []).length ? (
        <section className="person-detail-section">
          <div className="person-detail-card">
            <h3>📚 Publikationen</h3>
            <div className="pub-list">
              {(person.Publications || []).map((link) => {
                const pub = link.Publication;
                if (!pub) return null;
                const href = pub.URL || (pub.DOI ? `https://doi.org/${pub.DOI}` : null);
                return (
                  <article className="pub-item" key={`${link.id || pub.id}`}>
                    <div className="pub-title">{pub.Title || "Ohne Titel"}</div>
                    <div className="pub-meta">{publicationMeta(pub)}</div>
                    <div className="pub-links">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          Öffnen
                        </a>
                      ) : (
                        <span className="empty">Kein Link</span>
                      )}
                      {pub.Type ? <span className="pub-type">{pub.Type}</span> : null}
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
