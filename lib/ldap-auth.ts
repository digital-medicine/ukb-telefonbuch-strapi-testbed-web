import { SignJWT, jwtVerify } from "jose";
import { Client } from "ldapts";
import { cookies } from "next/headers";

const BASE_DN = process.env.LDAP_SEARCH_BASE || "OU=Administration,DC=ukb,DC=klinik,DC=bn";
const COOKIE_NAME = "ukb_directory_session";

function sessionKey() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

function escapeFilter(value: string) {
  return value.replace(/[\\*()\0]/g, (char) => `\\${char.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

export async function authenticateLdap(username: string, password: string) {
  const url = process.env.LDAP_URL;
  const bindDn = process.env.LDAP_BIND_DN;
  const bindPassword = process.env.LDAP_BIND_PASSWORD;
  if (!url || !bindDn || !bindPassword) throw new Error("LDAP connection is not configured");
  const client = new Client({ url, timeout: 8000, connectTimeout: 8000 });
  try {
    await client.bind(bindDn, bindPassword);
    const filterTemplate = process.env.LDAP_USER_FILTER || "(sAMAccountName={{username}})";
    const filter = filterTemplate.replaceAll("{{username}}", escapeFilter(username));
    const { searchEntries } = await client.search(BASE_DN, {
      scope: "sub",
      filter,
      attributes: ["dn", "sAMAccountName", "mail", "userPrincipalName", "displayName"],
      sizeLimit: 2,
    });
    if (searchEntries.length !== 1) return null;
    const userDn = String(searchEntries[0].dn || "");
    if (!userDn) return null;
    try {
      await client.bind(userDn, password);
    } catch {
      return null;
    }
    return {
      username: String(searchEntries[0].sAMAccountName || username),
      email: String(searchEntries[0].mail || searchEntries[0].userPrincipalName || "").toLowerCase(),
      displayName: String(searchEntries[0].displayName || ""),
    };
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

export async function createSession(identity: { username: string; email: string; displayName: string }) {
  return new SignJWT(identity).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(sessionKey());
}

export async function readSession(token?: string | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (typeof payload.username !== "string") return null;
    return { username: payload.username, email: String(payload.email || ""), displayName: String(payload.displayName || "") };
  } catch {
    return null;
  }
}

export const ldapSessionCookie = COOKIE_NAME;

export async function currentLdapSession() {
  const jar = await cookies();
  return readSession(jar.get(COOKIE_NAME)?.value);
}
