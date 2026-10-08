import Link from "next/link";

import EditContactForm from "./EditContactForm";
import { fetchPersonByDocumentId, formatPersonName } from "@/lib/people";
import { sessionCanEditPerson } from "@/lib/ldap-person";
import { currentLdapSession } from "@/lib/ldap-auth";
import { getAuthenticatedPersonLabel } from "@/lib/strapi-admin";
import { redirect } from "next/navigation";

export default async function ContactEditPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const session = await currentLdapSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/contact/${documentId}/edit`)}`);
  const accountLabel = await getAuthenticatedPersonLabel(session);
  const person = await fetchPersonByDocumentId(documentId);
  if (!person) return <main className="mx-auto max-w-3xl p-8">Kontakt nicht gefunden.</main>;
  const authorized = await sessionCanEditPerson(documentId);

  return (
    <main className="mx-auto max-w-[1120px] px-6 pb-14 pt-8 text-[var(--ink)]">
      <div className="mb-6 grid gap-3">
        <Link
          href={`/contact/${documentId}`}
          className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-[rgba(255,255,255,0.8)] px-3 py-2 font-semibold text-[var(--ink)] no-underline backdrop-blur-[8px] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Zurück zum Kontakt
        </Link>
        <h1 className="m-0 text-[clamp(2rem,3vw,2.8rem)] tracking-[-0.02em] text-[#111318]">Bearbeitungszugang</h1>
      </div>

      <section className="mb-[18px]">
        <div className="rounded-[18px] border border-[var(--card-border)] bg-[linear-gradient(180deg,#ffffff,#fcfcfd)] p-[18px] text-[#111318] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          {authorized ? (
            <>
              <p className="m-0 text-[0.95rem] text-[#2f3640]">
                Du kannst jetzt die freigegebenen Kontaktdaten anpassen und direkt speichern.
              </p>
              <EditContactForm
                documentId={documentId}
                initial={{
                  ORCID: person.ORCID,
                  Location: person.Location,
                  Phone: person.Phone,
                  Mail: person.Mail,
                  Address: person.Address,
                  EmployeePicture: person.EmployeePicture,
                }}
              />
            </>
          ) : (
            <>
              <h2 className="mb-[10px] mt-0 text-[#111318]">Anmeldung erfolgreich, aber kein Bearbeitungszugriff</h2>
              <p className="m-0 text-[0.95rem] text-[#2f3640]">
                Angemeldet als <strong>{accountLabel}</strong>. Es muss entweder dieselbe Kennung unter <code>LDAPUsername</code> hinterlegt oder die Business-E-Mail-Adresse des LDAP-Kontos mit der Business-Adresse dieses Kontakts identisch sein.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
