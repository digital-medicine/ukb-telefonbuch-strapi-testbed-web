import { NextRequest } from "next/server";

import { fetchPersonByDocumentId, hashSecret } from "@/lib/people";

const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";

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
  const formData = await req.formData().catch(() => null);
  const token = clean(formData?.get("token"));
  const file = formData?.get("file");

  if (!documentId || !token || !(file instanceof File)) {
    return Response.json({ error: "Missing documentId, token or file" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Only image uploads are supported" }, { status: 400 });
  }

  const person = await fetchPersonByDocumentId(documentId, { includeSecret: true });
  if (!person?.Secret || hashSecret(token) !== person.Secret) {
    return Response.json({ error: "Invalid edit token" }, { status: 403 });
  }

  try {
    const uploadData = new FormData();
    uploadData.append("files", file);

    const uploadResponse = await fetch(`${STRAPI_URL}/api/upload`, {
      method: "POST",
      headers: {
        ...authHeaders(),
      },
      body: uploadData,
      cache: "no-store",
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text().catch(() => "");
      throw new Error(`Upload HTTP ${uploadResponse.status} ${text}`);
    }

    const uploaded = (await uploadResponse.json()) as Array<{ id?: number | null }>;
    const fileId = uploaded?.[0]?.id;
    if (!fileId) {
      throw new Error("Upload returned no file id");
    }

    const updateResponse = await fetch(`${STRAPI_URL}/api/people/${documentId}?status=draft`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        data: {
          EmployeePicture: fileId,
        },
      }),
      cache: "no-store",
    });

    if (!updateResponse.ok) {
      const text = await updateResponse.text().catch(() => "");
      throw new Error(`Strapi HTTP ${updateResponse.status} ${text}`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
