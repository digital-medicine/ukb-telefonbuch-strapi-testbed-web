import { NextRequest } from "next/server";

import { ADDRESS_LABEL_OPTIONS, MAIL_LABEL_OPTIONS, PHONE_LABEL_OPTIONS } from "@/lib/contact-labels";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { fetchPersonByDocumentId, hashSecret } from "@/lib/people";

const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";
const ALLOWED_PHONE_LABELS = new Set<string>(PHONE_LABEL_OPTIONS.map((option) => option.value));
const ALLOWED_MAIL_LABELS = new Set<string>(MAIL_LABEL_OPTIONS.map((option) => option.value));
const ALLOWED_ADDRESS_LABELS = new Set<string>(ADDRESS_LABEL_OPTIONS.map((option) => option.value));
const ALLOWED_COUNTRIES = new Set<string>(COUNTRY_OPTIONS as readonly string[]);

type Payload = {
  token?: string;
  ORCID?: string | null;
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

function clean(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function authHeaders(): Record<string, string> {
  if (!STRAPI_TOKEN) return {};
  return { Authorization: `Bearer ${STRAPI_TOKEN}` };
}

function sanitizePhones(list: Payload["Phone"] = []) {
  return list
    .map((entry) => ({
      Label: ALLOWED_PHONE_LABELS.has(clean(entry?.Label)) ? clean(entry?.Label) : null,
      Number: clean(entry?.Number) || null,
    }))
    .filter((entry) => entry.Label || entry.Number);
}

function sanitizeMails(list: Payload["Mail"] = []) {
  return list
    .map((entry) => ({
      Label: ALLOWED_MAIL_LABELS.has(clean(entry?.Label)) ? clean(entry?.Label) : null,
      Address: clean(entry?.Address) || null,
    }))
    .filter((entry) => entry.Label || entry.Address);
}

function sanitizeAddresses(list: Payload["Address"] = []) {
  return list
    .map((entry) => ({
      Label: ALLOWED_ADDRESS_LABELS.has(clean(entry?.Label)) ? clean(entry?.Label) : null,
      StreetName: clean(entry?.StreetName) || null,
      StreetNumber: clean(entry?.StreetNumber) || null,
      Zip: clean(entry?.Zip) || null,
      City: clean(entry?.City) || null,
      State: clean(entry?.State) || null,
      Country: ALLOWED_COUNTRIES.has(clean(entry?.Country)) ? clean(entry?.Country) : null,
    }))
    .filter((entry) =>
      entry.Label ||
      entry.StreetName ||
      entry.StreetNumber ||
      entry.Zip ||
      entry.City ||
      entry.State ||
      entry.Country
    );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await context.params;
  const body = (await req.json().catch(() => null)) as Payload | null;
  const token = clean(body?.token);

  if (!documentId || !token) {
    return Response.json({ error: "Missing documentId or token" }, { status: 400 });
  }

  const person = await fetchPersonByDocumentId(documentId, { includeSecret: true });
  if (!person?.Secret || hashSecret(token) !== person.Secret) {
    return Response.json({ error: "Invalid edit token" }, { status: 403 });
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
          ORCID: clean(body?.ORCID) || null,
          Phone: sanitizePhones(body?.Phone),
          Mail: sanitizeMails(body?.Mail),
          Address: sanitizeAddresses(body?.Address),
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
