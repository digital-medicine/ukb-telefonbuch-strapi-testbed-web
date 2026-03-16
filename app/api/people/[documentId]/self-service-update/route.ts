import { NextRequest } from "next/server";

import { fetchPersonByDocumentId, hashSecret } from "@/lib/people";
import { validateSelfServicePayload } from "@/lib/validation";

const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";

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

  const validation = validateSelfServicePayload({
    ORCID: body?.ORCID,
    Phone: body?.Phone,
    Mail: body?.Mail,
    Address: body?.Address,
  });

  if (validation.hasErrors) {
    return Response.json({ error: "Bitte Eingaben prüfen.", validation: validation.errors }, { status: 400 });
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
          ORCID: validation.sanitized.ORCID,
          Phone: validation.sanitized.Phone,
          Mail: validation.sanitized.Mail,
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
