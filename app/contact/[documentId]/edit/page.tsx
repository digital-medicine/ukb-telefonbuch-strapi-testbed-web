import Link from "next/link";

import { fetchPersonByDocumentId, formatPersonName, hashSecret } from "@/lib/people";

export default async function ContactEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { documentId } = await params;
  const resolvedSearchParams = await searchParams;
  const token = (resolvedSearchParams.token || "").trim();

  const person = await fetchPersonByDocumentId(documentId, { includeSecret: true });
  const tokenIsValid = Boolean(person && token && person.Secret && hashSecret(token) === person.Secret);

  return (
    <main className="person-page">
      <div className="person-page-header">
        <Link href={`/contact/${documentId}`} className="back-link">
          Zurueck zum Kontakt
        </Link>
        <h1 className="person-page-title">Bearbeitungszugang</h1>
      </div>

      <section className="person-detail-section">
        <div className="person-detail-card">
          {tokenIsValid && person ? (
            <>
              <h2 className="edit-state-title">Link gueltig fuer {formatPersonName(person)}</h2>
              <p className="edit-state-copy">
                Der Bearbeitungslink wurde erfolgreich verifiziert. Die eigentliche Bearbeitungsmaske kann jetzt auf
                dieser Route aufgebaut werden.
              </p>
            </>
          ) : (
            <>
              <h2 className="edit-state-title">Link ungueltig</h2>
              <p className="edit-state-copy">
                Dieser Bearbeitungslink ist ungueltig oder wurde nicht korrekt uebermittelt.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
