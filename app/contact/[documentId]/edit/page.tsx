import Link from "next/link";

import EditContactForm from "./EditContactForm";
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
          Zurück zum Kontakt
        </Link>
        <h1 className="person-page-title">Bearbeitungszugang</h1>
      </div>

      <section className="person-detail-section">
        <div className="person-detail-card">
          {tokenIsValid && person ? (
            <>
              <h2 className="edit-state-title">Link gültig für {formatPersonName(person)}</h2>
              <p className="edit-state-copy">
                Du kannst jetzt die freigegebenen Kontaktdaten anpassen und direkt speichern.
              </p>
              <EditContactForm
                documentId={documentId}
                token={token}
                initial={{
                  ORCID: person.ORCID,
                  Phone: person.Phone,
                  Mail: person.Mail,
                  Address: person.Address,
                  EmployeePicture: person.EmployeePicture,
                }}
              />
            </>
          ) : (
            <>
              <h2 className="edit-state-title">Link ungültig</h2>
              <p className="edit-state-copy">
                Dieser Bearbeitungslink ist ungültig oder wurde nicht korrekt übermittelt.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
