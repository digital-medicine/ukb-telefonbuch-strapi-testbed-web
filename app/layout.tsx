import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { currentLdapSession } from "@/lib/ldap-auth";
import { getAuthenticatedPersonLabel, hasOrganizationManagerAccess } from "@/lib/strapi-admin";
import LogoutButton from "./LogoutButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UKB Telefonbuch",
  description: "UKB Telefonbuch",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await currentLdapSession();
  const canManageOrganizations = session ? await hasOrganizationManagerAccess(session.username).catch(() => false) : false;
  const accountLabel = session ? await getAuthenticatedPersonLabel(session) : "";
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="border-b border-[#dce2e9] bg-white/90 text-[#182231] shadow-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <Link href="/" className="font-bold tracking-tight text-[#123e59] no-underline">UKB Telefonbuch</Link>
            <nav aria-label="Anmeldung" className="flex flex-wrap items-center gap-3 text-sm">
              {session ? <>
                <span className="text-[#596579]">Angemeldet als <strong className="text-[#182231]">{accountLabel}</strong></span>
                <Link href="/me" className="rounded-lg bg-[#145c86] px-3 py-2 font-semibold text-white no-underline hover:bg-[#104b6e]">Meine Daten</Link>
                {canManageOrganizations ? <Link href="/admin" className="rounded-lg border border-[#b9c3d0] px-3 py-2 font-semibold text-[#182231] no-underline hover:bg-[#f3f6f8]">Bereiche verwalten</Link> : null}
                <LogoutButton />
              </> : <Link href="/login" className="rounded-lg border border-[#b9c3d0] px-3 py-2 font-semibold text-[#182231] no-underline hover:bg-[#f3f6f8]">Anmelden</Link>}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
