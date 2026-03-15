import Link from "next/link";
import { notFound } from "next/navigation";

import EditLinkButton from "./EditLinkButton";
import { fetchPersonByDocumentId, findBusinessMail, formatPersonName } from "@/lib/people";

function formatAddress(address: {
  StreetName?: string | null;
  StreetNumber?: string | null;
  Zip?: string | null;
  City?: string | null;
  State?: string | null;
  Country?: string | null;
}) {
  const line1 = [address.StreetName, address.StreetNumber].filter(Boolean).join(" ").trim();
  const line2 = [address.Zip, address.City].filter(Boolean).join(" ").trim();
  const line3 = [address.State, address.Country].filter(Boolean).join(", ").trim();
  return [line1, line2, line3].filter(Boolean).join(" · ");
}

function publicationMeta(pub: {
  PublishedDate?: string | null;
  Journal?: string | null;
}) {
  const year = pub.PublishedDate?.slice(0, 4) || "";
  return [year, pub.Journal].filter(Boolean).join(" · ");
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
  const businessPhone = (person.Phone || []).find((entry) => (entry.Label || "").toLowerCase() === "business")?.Number;

  return (
    <main className="person-page">
      <div className="person-page-header">
        <Link href="/" className="back-link">
          Zurueck zum Telefonbuch
        </Link>
        <h1 className="person-page-title">{formatPersonName(person)}</h1>
        <p className="person-page-subtitle">
          Kontaktdetails, Organisationen und Publikationen fuer diesen Eintrag.
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

            <div className="person-detail-grid">
              <section className="person-detail-card">
                <h3>Telefon</h3>
                {(person.Phone || []).length ? (
                  <ul>
                    {(person.Phone || []).map((entry, index) => (
                      <li key={`${entry.Label || "phone"}-${index}`}>
                        <span>{entry.Label || "Telefon"}:</span>{" "}
                        {entry.Number ? (
                          <a href={`tel:${entry.Number.replace(/\s/g, "")}`}>{entry.Number}</a>
                        ) : (
                          "—"
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty">Keine Nummern hinterlegt.</p>
                )}
              </section>

              <section className="person-detail-card">
                <h3>E-Mail</h3>
                {(person.Mail || []).length ? (
                  <ul>
                    {(person.Mail || []).map((entry, index) => (
                      <li key={`${entry.Label || "mail"}-${index}`}>
                        <span>{entry.Label || "E-Mail"}:</span>{" "}
                        {entry.Address ? <a href={`mailto:${entry.Address}`}>{entry.Address}</a> : "—"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty">Keine E-Mails hinterlegt.</p>
                )}
              </section>

              <section className="person-detail-card">
                <h3>Adressen</h3>
                {(person.Address || []).length ? (
                  <ul>
                    {(person.Address || []).map((entry, index) => (
                      <li key={`${entry.Label || "address"}-${index}`}>
                        <span>{entry.Label || "Adresse"}:</span> {formatAddress(entry) || "—"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty">Keine Adressen hinterlegt.</p>
                )}
              </section>
            </div>

            {businessMail ? <EditLinkButton documentId={documentId} /> : null}
          </div>
        </div>
      </section>

      <section className="person-detail-section">
        <div className="person-detail-card person-detail-card-wide">
          <h3>Organisationen</h3>
          {(person.Organizations || []).length ? (
            <ul className="organization-list">
              {(person.Organizations || []).map((org, index) => (
                <li key={`${org.documentId || org.id || index}`} className="organization-item">
                  <span className="organization-name">{org.Name || org.ShortName || "(ohne Name)"}</span>
                  {org.AffiliationPrimary ? <span className="organization-badge">Primaer</span> : null}
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
            <h3>Publikationen</h3>
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
                          Oeffnen
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
