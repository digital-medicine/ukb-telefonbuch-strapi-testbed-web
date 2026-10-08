import { redirect } from "next/navigation";
import Link from "next/link";
import { currentLdapSession } from "@/lib/ldap-auth";
import { getAuthenticatedPersonLabel, getManagerOrganizationIds } from "@/lib/strapi-admin";
import AdminDirectory from "./AdminDirectory";

export default async function AdminPage() {
  const session = await currentLdapSession();
  if (!session) redirect("/login?next=%2Fadmin");
  const accountLabel = await getAuthenticatedPersonLabel(session);
  let allowedIds: string[] = [];
  try {
    const access = await getManagerOrganizationIds(session.username);
    allowedIds = access.allowedIds;
  } catch (error) {
    console.error("Organization manager access check failed", error);
  }
  if (allowedIds.length) return <main className="mx-auto max-w-6xl px-5 py-8 text-[#182231] sm:px-8">
    <div className="mb-7">
      <Link href="/" className="inline-flex rounded-lg border border-[#b9c3d0] bg-white px-3 py-2 text-sm font-semibold text-[#145c86] no-underline hover:bg-[#f3f6f8]">Zurück zum Telefonbuch</Link>
      <p className="mb-0 mt-5 text-sm font-semibold uppercase tracking-wider text-[#145c86]">UKB Telefonbuch</p>
      <h1 className="mb-1 mt-1 text-3xl font-bold">Bereiche verwalten</h1>
      <p className="m-0 text-[#596579]">Organisationseinheiten, Zuständigkeiten und Personenzuordnungen deiner Bereiche verwalten.</p>
    </div>
    <AdminDirectory />
  </main>;
  return <main className="mx-auto max-w-3xl px-6 py-10 text-[#182231]">
    <section className="rounded-2xl border border-[#dce2e9] bg-white p-6 shadow-sm">
      <h1 className="mt-0 text-2xl font-bold">Keine Organisationsverwaltung zugeordnet</h1>
      <p>Angemeldet als <strong>{accountLabel}</strong>. Für dieses Konto wurde keine verwaltbare Organisation gefunden. Prüfe in Strapi unter <strong>Content Manager → Organization → Managers</strong>, ob diese Person eingetragen ist und ihr Personeneintrag denselben LDAPUsername wie das angemeldete Konto enthält.</p>
      <Link href="/" className="font-semibold text-[#145c86]">Zurück zum Telefonbuch</Link>
    </section>
  </main>;
}
