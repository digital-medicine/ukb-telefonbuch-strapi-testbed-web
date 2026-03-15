import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";

import { fetchPersonByDocumentId, findBusinessMail, formatPersonName, hashSecret, updatePersonSecret } from "@/lib/people";
import { sendEditLinkMail } from "@/lib/mailer";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await context.params;
  if (!documentId) {
    return Response.json({ error: "Missing documentId" }, { status: 400 });
  }

  try {
    const person = await fetchPersonByDocumentId(documentId, { includeSecret: true });
    if (!person) {
      return Response.json({ error: "Person not found" }, { status: 404 });
    }

    const businessMail = findBusinessMail(person);
    if (!businessMail) {
      return Response.json({ error: "No business email configured" }, { status: 400 });
    }

    const rawToken = randomBytes(32).toString("hex");
    const secretHash = hashSecret(rawToken);
    await updatePersonSecret(documentId, secretHash);

    const origin = req.nextUrl.origin;
    const editUrl = `${origin}/contact/${encodeURIComponent(documentId)}/edit?token=${encodeURIComponent(rawToken)}`;

    await sendEditLinkMail({
      to: businessMail,
      personName: formatPersonName(person),
      editUrl,
    });

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
