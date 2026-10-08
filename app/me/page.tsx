import Link from "next/link";
import { redirect } from "next/navigation";
import { currentLdapSession } from "@/lib/ldap-auth";
import { strapiAdmin } from "@/lib/strapi-admin";

async function findOwnPerson(username: string, email: string) {
  const directQuery = new URLSearchParams({
    status: "draft",
    "filters[LDAPUsername][$eqi]": username,
    "pagination[pageSize]": "2",
    "fields[0]": "documentId",
  });
  const direct = await strapiAdmin(`/api/people?${directQuery}`);
  if (direct.data?.length === 1) return String(direct.data[0].documentId);
  if (direct.data?.length || !email) return null;

  const mailQuery = new URLSearchParams({
    status: "draft",
    "filters[Mail][Label][$eqi]": "business",
    "filters[Mail][Address][$eqi]": email,
    "pagination[pageSize]": "2",
    "fields[0]": "documentId",
  });
  const byMail = await strapiAdmin(`/api/people?${mailQuery}`);
  return byMail.data?.length === 1 ? String(byMail.data[0].documentId) : null;
}

export default async function MyProfilePage() {
  const session = await currentLdapSession();
  if (!session) redirect("/login?next=%2Fme");
  let documentId: string | null = null;
  try {
    documentId = await findOwnPerson(session.username, session.email);
  } catch (error) {
    console.error("Could not resolve LDAP user to a phonebook entry", error);
  }
  if (documentId) redirect(`/contact/${encodeURIComponent(documentId)}/edit`);

  return <main className="mx-auto max-w-3xl px-6 py-10 text-[#182231]">
    <section className="rounded-2xl border border-[#dce2e9] bg-white p-6 shadow-sm">
      <h1 className="mt-0 text-2xl font-bold">Kein persönlicher Eintrag gefunden</h1>
      <p>Für <strong>{session.username}</strong> konnte kein eindeutiger Kontakteintrag zugeordnet werden. Bitte wende dich an die Telefonbuch-Administration, damit bei deiner Person der LDAP-Benutzername hinterlegt wird.</p>
      <Link href="/" className="font-semibold text-[#145c86]">Zurück zum Telefonbuch</Link>
    </section>
  </main>;
}
