/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";

import { requestCanEditPerson } from "@/lib/ldap-person";
import { validateSelfServicePayload } from "@/lib/validation";

const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";

type Payload = {
  ORCID?: string | null;
  Location?: string | null;
  Phone?: Array<{ Label?: string | null; Number?: string | null }>;
  Mail?: Array<{ Label?: string | null; Address?: string | null }>;
  Address?: Array<{
    Label?: string | null;
    StreetName?: string | null;
    StreetNumber?: string | null;
    Zip?: string | null;
    City?: string | null;
    State?: string | null;
    Country?: string | null;
  }>;
};

function contactKey(row: any, fields: string[]) {
  return fields.map((field) => String(row?.[field] ?? "").trim().toLowerCase()).join("\u0000");
}

function mergeLdapContacts(submitted: any[], current: any[], fields: string[]) {
  const incoming = Array.isArray(submitted) ? submitted : [];
  const existing = Array.isArray(current) ? current : [];
  const managed = existing.filter((row) => row?.LDAPManaged !== false);
  const used = new Set<number>();
  const merged: any[] = [];
  for (const row of managed) {
    const index = incoming.findIndex((candidate, i) => !used.has(i) && contactKey(candidate, fields) === contactKey(row, fields));
    if (index < 0) return null;
    used.add(index);
    merged.push({ ...row, ...Object.fromEntries(fields.map((field) => [field, row[field] ?? null])), LDAPManaged: true });
  }
  incoming.forEach((row, index) => {
    if (!used.has(index)) merged.push({ ...row, LDAPManaged: false });
  });
  return merged;
}

function authHeaders(): Record<string, string> {
  if (!STRAPI_TOKEN) return {};
  return { Authorization: `Bearer ${STRAPI_TOKEN}` };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await context.params;
  const body = (await req.json().catch(() => null)) as Payload | null;
  if (!documentId) {
    return Response.json({ error: "Missing documentId" }, { status: 400 });
  }
  if (!(await requestCanEditPerson(req, documentId))) {
    return Response.json({ error: "LDAP-Anmeldung für diese Person erforderlich." }, { status: 403 });
  }

  // LDAP-owned contact fields may not be changed through self-service. ORCID
  // editing is temporarily disabled and omitted from updates.
  const currentQuery = new URLSearchParams({
    status: "draft",
    "fields[0]": "LDAPUsername",
    "populate[Phone]": "*",
    "populate[Mail]": "*",
  });
  const currentResponse = await fetch(
    `${STRAPI_URL}/api/people/${encodeURIComponent(documentId)}?${currentQuery}`,
    { headers: authHeaders(), cache: "no-store" }
  );
  if (!currentResponse.ok) {
    console.error("Self-service person lookup failed", {
      documentId,
      status: currentResponse.status,
      details: (await currentResponse.text().catch(() => "")).slice(0, 500),
    });
    return Response.json({ error: "Person konnte nicht geladen werden." }, { status: 502 });
  }
  const currentJson = await currentResponse.json();
  const current = currentJson?.data?.attributes ? { ...currentJson.data.attributes } : currentJson?.data || {};
  const validation = validateSelfServicePayload({
    Location: body?.Location,
    Phone: body?.Phone,
    Mail: body?.Mail,
    Address: body?.Address,
  });

  if (validation.hasErrors) {
    return Response.json({ error: "Bitte Eingaben prüfen.", validation: validation.errors }, { status: 400 });
  }

  const protectedPhones = current.LDAPUsername
    ? mergeLdapContacts(validation.sanitized.Phone, current.Phone, ["Label", "Number"])
    : validation.sanitized.Phone;
  const protectedMails = current.LDAPUsername
    ? mergeLdapContacts(validation.sanitized.Mail, current.Mail, ["Label", "Address"])
    : validation.sanitized.Mail;
  if (protectedPhones === null || protectedMails === null) {
    return Response.json({ error: "LDAP-importierte Telefon- und E-Mail-Einträge dürfen nicht geändert oder entfernt werden." }, { status: 403 });
  }

  try {
    const response = await fetch(`${STRAPI_URL}/api/people/${documentId}?status=draft`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        data: {
          Location: validation.sanitized.Location,
          Phone: protectedPhones,
          Mail: protectedMails,
          Address: validation.sanitized.Address,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Strapi HTTP ${response.status} ${text}`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
