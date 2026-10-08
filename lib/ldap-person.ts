import { currentLdapSession, ldapSessionCookie, readSession } from "@/lib/ldap-auth";
import { NextRequest } from "next/server";

const base = process.env.STRAPI_URL?.replace(/\/$/, "");

export async function sessionCanEditPerson(documentId: string) {
  const session = await currentLdapSession();
  return sessionCanEditWithIdentity(documentId, session);
}

export async function requestCanEditPerson(request: NextRequest, documentId: string) {
  const session = await readSession(request.cookies.get(ldapSessionCookie)?.value);
  return sessionCanEditWithIdentity(documentId, session);
}

async function sessionCanEditWithIdentity(
  documentId: string,
  identity: { username: string; email: string; displayName: string } | null
) {
  if (!identity || !base) return false;
  // Read the draft version: LDAPUsername can be maintained in Strapi before
  // the directory entry is published, while the default API response is live-only.
  const response = await fetch(`${base}/api/people/${encodeURIComponent(documentId)}?status=draft&fields[0]=LDAPUsername&populate[Mail]=*`, {
    headers: process.env.STRAPI_TOKEN ? { Authorization: `Bearer ${process.env.STRAPI_TOKEN}` } : {},
    cache: "no-store",
  });
  if (!response.ok) return false;
  const json = await response.json();
  const ldapUsername = json?.data?.LDAPUsername ?? json?.data?.attributes?.LDAPUsername;
  const linkedUsername = String(ldapUsername ?? "").trim();
  const loginUsername = String(identity.username ?? "").trim();
  if (linkedUsername) {
    return linkedUsername.toLocaleLowerCase("en-US") === loginUsername.toLocaleLowerCase("en-US");
  }

  if (!identity.email) return false;
  const mails = json?.data?.Mail ?? json?.data?.attributes?.Mail ?? [];
  const hasMatchingBusinessMail = mails.some((entry: any) => {
    const mail = entry?.attributes ?? entry;
    const label = String(mail?.Label ?? "").trim().toLowerCase();
    const address = String(mail?.Address ?? "").trim().toLowerCase();
    return label === "business" && address === identity.email.trim().toLowerCase();
  });
  if (!hasMatchingBusinessMail) return false;

  const filters = new URLSearchParams({
    status: "draft",
    "filters[Mail][Label][$eqi]": "business",
    "filters[Mail][Address][$eqi]": identity.email.trim(),
    "pagination[pageSize]": "2",
    "fields[0]": "documentId",
  });
  const matchResponse = await fetch(`${base}/api/people?${filters}`, {
    headers: process.env.STRAPI_TOKEN ? { Authorization: `Bearer ${process.env.STRAPI_TOKEN}` } : {},
    cache: "no-store",
  });
  if (!matchResponse.ok) return false;
  const matches = await matchResponse.json();
  return matches?.data?.length === 1 && matches.data[0]?.documentId === documentId;
}
