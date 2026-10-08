import { NextResponse } from "next/server";
import { ldapSessionCookie } from "@/lib/ldap-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(ldapSessionCookie);
  return response;
}
