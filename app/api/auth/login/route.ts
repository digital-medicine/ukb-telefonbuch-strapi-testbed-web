import { NextRequest, NextResponse } from "next/server";
import { authenticateLdap, createSession, ldapSessionCookie } from "@/lib/ldap-auth";

export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => null);
  const username = typeof data?.username === "string" ? data.username.trim() : "";
  const password = typeof data?.password === "string" ? data.password : "";
  if (!username || !password || username.length > 128 || password.length > 1024) {
    return NextResponse.json({ error: "Benutzername und Passwort erforderlich." }, { status: 400 });
  }
  try {
    const identity = await authenticateLdap(username, password);
    if (!identity) return NextResponse.json({ error: "Anmeldung fehlgeschlagen." }, { status: 401 });
    const token = await createSession(identity);
    const response = NextResponse.json({ ok: true });
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const isHttps = forwardedProto ? forwardedProto === "https" : request.nextUrl.protocol === "https:";
    response.cookies.set(ldapSessionCookie, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("LDAP login unavailable", error);
    return NextResponse.json({ error: "Anmeldung ist derzeit nicht verfügbar." }, { status: 503 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ldapSessionCookie);
  return response;
}
