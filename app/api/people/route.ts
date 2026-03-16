/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";

const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";
const STRAPI_BASE = STRAPI_URL?.replace(/\/$/, "") || "";

function authHeaders(): Record<string, string> {
  if (!STRAPI_TOKEN) return {};
  return { Authorization: `Bearer ${STRAPI_TOKEN}` };
}

function absUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${STRAPI_BASE}${url}`;
}

function clean(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function labelEquals(value: unknown, expected: string) {
  return clean(value).toLowerCase() === clean(expected).toLowerCase();
}

function addTokenSearchFilters(sp: URLSearchParams, tokens: string[]) {
  tokens.forEach((token, tokenIndex) => {
    const base = `filters[$and][${tokenIndex}][$or]`;
    sp.set(`${base}[0][Firstname][$containsi]`, token);
    sp.set(`${base}[1][Lastname][$containsi]`, token);
    sp.set(`${base}[2][MailIdentifier][$containsi]`, token);
    sp.set(`${base}[3][Mail][Address][$containsi]`, token);
    sp.set(`${base}[4][Phone][Number][$containsi]`, token);
    sp.set(`${base}[5][Organizations][Name][$containsi]`, token);
    sp.set(`${base}[6][Organizations][ShortName][$containsi]`, token);
    sp.set(`${base}[7][PrimaryOrganization][Name][$containsi]`, token);
    sp.set(`${base}[8][PrimaryOrganization][ShortName][$containsi]`, token);
  });
}

function normalizeSearchValue(value: unknown) {
  return clean(value).toLowerCase();
}

function scorePersonMatch(person: any, tokens: string[], rawQuery: string) {
  const fullName = normalizeSearchValue(
    [person.Title, person.Firstname, person.Lastname].filter(Boolean).join(" ")
  );
  const firstName = normalizeSearchValue(person.Firstname);
  const lastName = normalizeSearchValue(person.Lastname);
  const identifier = normalizeSearchValue(person.MailIdentifier);
  const mailValues = (person.Mail || []).map((entry: any) => normalizeSearchValue(entry?.Address));
  const phoneValues = (person.Phone || []).map((entry: any) => normalizeSearchValue(entry?.Number));
  const organizationValues = (person.Organizations || []).flatMap((org: any) => [
    normalizeSearchValue(org?.Name),
    normalizeSearchValue(org?.ShortName),
  ]);

  let score = 0;
  const query = normalizeSearchValue(rawQuery);

  if (query) {
    if (fullName === query) score += 1000;
    else if (fullName.startsWith(query)) score += 700;
    else if (fullName.includes(query)) score += 450;

    if (identifier === query) score += 900;
    else if (identifier.includes(query)) score += 350;

    for (const mail of mailValues) {
      if (!mail) continue;
      if (mail === query) score += 850;
      else if (mail.startsWith(query)) score += 500;
      else if (mail.includes(query)) score += 300;
    }

    for (const phone of phoneValues) {
      if (!phone) continue;
      if (phone === query) score += 820;
      else if (phone.includes(query)) score += 280;
    }
  }

  for (const token of tokens.map((entry) => normalizeSearchValue(entry))) {
    if (!token) continue;
    if (firstName === token) score += 260;
    else if (firstName.startsWith(token)) score += 180;
    else if (firstName.includes(token)) score += 100;

    if (lastName === token) score += 320;
    else if (lastName.startsWith(token)) score += 220;
    else if (lastName.includes(token)) score += 120;

    if (identifier.includes(token)) score += 90;

    for (const mail of mailValues) {
      if (mail.includes(token)) score += 80;
    }

    for (const phone of phoneValues) {
      if (phone.includes(token)) score += 85;
    }

    for (const org of organizationValues) {
      if (!org) continue;
      if (org === token) score += 40;
      else if (org.includes(token)) score += 20;
    }
  }

  return score;
}

function unwrapEntity(input: any) {
  if (!input) return null;
  if (input?.data) return unwrapEntity(input.data);
  if (input?.attributes) {
    return {
      id: input.id ?? null,
      documentId: input.documentId ?? null,
      ...input.attributes,
    };
  }
  return input;
}

function normalizeMedia(input: any) {
  if (!input) return null;
  const raw = input?.data?.attributes ? { id: input.data.id, ...input.data.attributes } : input;
  if (!raw) return null;
  const formats = raw.formats
    ? Object.fromEntries(
        Object.entries(raw.formats).map(([k, v]: any) => [
          k,
          { ...v, url: absUrl(v?.url ?? null) },
        ])
      )
    : null;
  return {
    id: raw.id ?? null,
    name: raw.name ?? null,
    alternativeText: raw.alternativeText ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    url: absUrl(raw.url ?? null),
    formats,
  };
}

function normalizePersonItem(it: any) {
  const attrs = it.attributes ?? it;

  const secretariats = (attrs.Secretariats ?? attrs.secretariats ?? [])
    .map((s: any) => normalizePersonRef(s))
    .filter(Boolean);

  const baseOrganizations = (attrs.Organizations ?? attrs.organizations ?? [])
    .map((entry: any) => normalizeOrganizationRef(entry))
    .filter(Boolean);

  const primaryOrganization = normalizeOrganizationRef(
    attrs.PrimaryOrganization ?? attrs.primaryOrganization
  );

  const primarySupervisor = normalizePersonRef(attrs.PrimarySupervisor ?? attrs.primarySupervisor);

  const supervisors = (attrs.Supervisors ?? attrs.supervisors ?? [])
    .map((entry: any) => normalizePersonRef(entry))
    .filter(Boolean);

  const leadershipLinks = (attrs.OrganizationLeadershipLinks ?? attrs.organizationLeadershipLinks ?? [])
    .map((entry: any) => normalizeLeadershipLink(entry))
    .filter(Boolean);

  let organizations = mergeOrganizations(baseOrganizations, primaryOrganization, leadershipLinks);

  if (!organizations.length) {
    const poRaw = attrs.PrimaryOrganization ?? attrs.primaryOrganization;
    const poName =
      clean(poRaw?.Name ?? poRaw?.name ?? poRaw?.data?.Name ?? poRaw?.data?.attributes?.Name ?? poRaw?.attributes?.Name) ||
      "";
    const poShort =
      clean(
        poRaw?.ShortName ??
          poRaw?.shortName ??
          poRaw?.data?.ShortName ??
          poRaw?.data?.attributes?.ShortName ??
          poRaw?.attributes?.ShortName
      ) || null;

    if (poName) {
      organizations = [
        {
          id: poRaw?.id ?? poRaw?.data?.id ?? null,
          documentId: poRaw?.documentId ?? poRaw?.data?.documentId ?? null,
          Name: poName,
          ShortName: poShort,
          AffiliationRole: null,
          AffiliationPrimary: true,
          LeadershipRoles: leadershipLinks.map((l: any) => l?.Role).filter(Boolean),
          LeadershipPrimary: leadershipLinks.some((l: any) => Boolean(l?.Primary)),
          SortOrder: 0,
        },
      ];
    }
  }

  return {
    id: it.id,
    documentId: it.documentId ?? attrs.documentId ?? null,
    Title: attrs.Title ?? attrs.title ?? null,
    Firstname: attrs.Firstname ?? attrs.firstname ?? null,
    Lastname: attrs.Lastname ?? attrs.lastname ?? null,
    MailIdentifier: attrs.MailIdentifier ?? attrs.mailIdentifier ?? null,
    WebexEnabled: Boolean(attrs.WebexEnabled ?? attrs.webexEnabled),
    WebexEmail: attrs.WebexEmail ?? attrs.webexEmail ?? null,
    Phone: attrs.Phone ?? attrs.phone ?? [],
    Mail: attrs.Mail ?? attrs.mail ?? [],
    Address: attrs.Address ?? attrs.address ?? [],
    EmployeePicture: normalizeMedia(attrs.EmployeePicture ?? attrs.employeePicture ?? null),
    Secretariats: secretariats,
    PrimarySupervisor: primarySupervisor,
    Supervisors: supervisors,
    Organizations: organizations,
  };
}

function normalizePersonRef(input: any) {
  const attrs = unwrapEntity(input);
  if (!attrs) return null;

  const title = clean(attrs.Title ?? attrs.title);
  const firstname = clean(attrs.Firstname ?? attrs.firstname);
  const lastname = clean(attrs.Lastname ?? attrs.lastname);
  const identifier = clean(attrs.MailIdentifier ?? attrs.mailIdentifier);
  const name =
    [title, firstname, lastname].filter(Boolean).join(" ").trim() ||
    [firstname, lastname].filter(Boolean).join(" ").trim() ||
    "(ohne Namen)";

  const mails = (attrs.Mail ?? attrs.mail ?? []) as Array<{ Label?: string; Address?: string }>;
  const phones = (attrs.Phone ?? attrs.phone ?? []) as Array<{ Label?: string; Number?: string }>;
  const addresses = (attrs.Address ?? attrs.address ?? []) as Array<any>;
  const organizations = (attrs.Organizations ?? attrs.organizations ?? [])
    .map((entry: any) => normalizeOrganizationRef(entry))
    .filter(Boolean);
  const primaryOrganization = normalizeOrganizationRef(
    attrs.PrimaryOrganization ?? attrs.primaryOrganization
  );
  const businessMail =
    mails.find((m) => labelEquals(m?.Label, "Business"))?.Address ||
    mails.find((m) => labelEquals(m?.Label, "Other"))?.Address ||
    mails[0]?.Address ||
    null;
  const businessPhone =
    phones.find((p) => labelEquals(p?.Label, "Business"))?.Number ||
    phones.find((p) => labelEquals(p?.Label, "Business Mobile"))?.Number ||
    phones[0]?.Number ||
    null;
  const allOrganizations = mergeOrganizations(organizations, primaryOrganization, []);

  return {
    id: attrs.id ?? input?.id ?? null,
    documentId: attrs.documentId ?? input?.documentId ?? null,
    Name: name,
    MailIdentifier: identifier || null,
    Email: businessMail ? clean(businessMail) : null,
    Phone: businessPhone ? clean(businessPhone) : null,
    Mail: mails,
    Phones: phones,
    Address: addresses,
    Organizations: allOrganizations,
  };
}

function normalizeOrganizationRef(input: any) {
  const attrs = unwrapEntity(input);
  if (!attrs) return null;
  return {
    id: attrs.id ?? input?.id ?? null,
    documentId: attrs.documentId ?? input?.documentId ?? null,
    Name: clean(attrs.Name ?? attrs.name) || null,
    ShortName: clean(attrs.ShortName ?? attrs.shortName) || null,
  };
}

function normalizeLeadershipLink(input: any) {
  const attrs = unwrapEntity(input);
  const org = normalizeOrganizationRef(attrs?.Organization ?? attrs?.organization);
  if (!org) return null;
  return {
    Organization: org,
    Role: clean(attrs?.Role ?? attrs?.role) || null,
    Primary: Boolean(attrs?.Primary ?? attrs?.primary),
    SortOrder: Number(attrs?.SortOrder ?? attrs?.sortOrder ?? 0),
  };
}

function mergeOrganizations(baseOrgs: any[], primaryOrg: any, leadLinks: any[]) {
  const byKey = new Map<string, any>();

  for (const org of baseOrgs) {
    if (!org) continue;
    const key = String(org.documentId || org.id);
    byKey.set(key, {
      id: org.id,
      documentId: org.documentId,
      Name: org.Name,
      ShortName: org.ShortName,
      AffiliationRole: null,
      AffiliationPrimary: false,
      LeadershipRoles: [] as string[],
      LeadershipPrimary: false,
      SortOrder: 100,
    });
  }

  if (primaryOrg) {
    const key = String(primaryOrg.documentId || primaryOrg.id);
    const existing = byKey.get(key) || {
      id: primaryOrg.id,
      documentId: primaryOrg.documentId,
      Name: primaryOrg.Name,
      ShortName: primaryOrg.ShortName,
      AffiliationRole: null,
      AffiliationPrimary: false,
      LeadershipRoles: [] as string[],
      LeadershipPrimary: false,
      SortOrder: 0,
    };
    existing.AffiliationPrimary = true;
    existing.SortOrder = 0;
    byKey.set(key, existing);
  }

  for (const link of leadLinks) {
    if (!link?.Organization) continue;
    const key = String(link.Organization.documentId || link.Organization.id);
    const existing = byKey.get(key) || {
      id: link.Organization.id,
      documentId: link.Organization.documentId,
      Name: link.Organization.Name,
      ShortName: link.Organization.ShortName,
      AffiliationRole: null,
      AffiliationPrimary: false,
      LeadershipRoles: [] as string[],
      LeadershipPrimary: false,
      SortOrder: Number(link.SortOrder ?? 100),
    };

    if (link.Role) existing.LeadershipRoles.push(link.Role);
    if (link.Primary) existing.LeadershipPrimary = true;
    existing.SortOrder = Math.min(existing.SortOrder ?? 100, Number(link.SortOrder ?? 100));
    byKey.set(key, existing);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.AffiliationPrimary !== b.AffiliationPrimary) return a.AffiliationPrimary ? -1 : 1;
    if (a.LeadershipPrimary !== b.LeadershipPrimary) return a.LeadershipPrimary ? -1 : 1;
    return Number(a.SortOrder || 0) - Number(b.SortOrder || 0);
  });
}

export async function GET(req: NextRequest) {
  if (!STRAPI_URL) return Response.json({ error: "Missing STRAPI_URL" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const identifier = (searchParams.get("identifier") || "").trim();
  const sort = searchParams.get("sort") || "Lastname:asc";
  const label = (searchParams.get("label") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") || "50") || 50));
  const queryTokens = q
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const sp = new URLSearchParams();
  sp.set("status", "draft");
  sp.set("populate[Phone]", "*");
  sp.set("populate[Mail]", "*");
  sp.set("populate[Address]", "*");
  sp.set("populate[EmployeePicture]", "true");
  sp.set("populate[Secretariats][populate]", "*");
  sp.set("populate[PrimaryOrganization][fields][0]", "Name");
  sp.set("populate[PrimaryOrganization][fields][1]", "ShortName");
  sp.set("populate[Organizations][fields][0]", "Name");
  sp.set("populate[Organizations][fields][1]", "ShortName");
  sp.set("populate[Secretariats][fields][0]", "Title");
  sp.set("populate[Secretariats][fields][1]", "Firstname");
  sp.set("populate[Secretariats][fields][2]", "Lastname");
  sp.set("populate[Secretariats][fields][3]", "MailIdentifier");
  sp.set("populate[Secretariats][populate][Phone]", "*");
  sp.set("populate[Secretariats][populate][Mail]", "*");
  sp.set("populate[Secretariats][populate][Address]", "*");
  sp.set("populate[Secretariats][populate][Organizations][fields][0]", "Name");
  sp.set("populate[Secretariats][populate][Organizations][fields][1]", "ShortName");
  sp.set("populate[Secretariats][populate][PrimaryOrganization][fields][0]", "Name");
  sp.set("populate[Secretariats][populate][PrimaryOrganization][fields][1]", "ShortName");
  sp.set("populate[PrimarySupervisor][fields][0]", "Title");
  sp.set("populate[PrimarySupervisor][fields][1]", "Firstname");
  sp.set("populate[PrimarySupervisor][fields][2]", "Lastname");
  sp.set("populate[PrimarySupervisor][fields][3]", "MailIdentifier");
  sp.set("populate[Supervisors][fields][0]", "Title");
  sp.set("populate[Supervisors][fields][1]", "Firstname");
  sp.set("populate[Supervisors][fields][2]", "Lastname");
  sp.set("populate[Supervisors][fields][3]", "MailIdentifier");
  sp.set("populate[OrganizationLeadershipLinks][fields][0]", "Role");
  sp.set("populate[OrganizationLeadershipLinks][fields][1]", "Primary");
  sp.set("populate[OrganizationLeadershipLinks][fields][2]", "SortOrder");
  sp.set("populate[OrganizationLeadershipLinks][populate][Organization][fields][0]", "Name");
  sp.set("populate[OrganizationLeadershipLinks][populate][Organization][fields][1]", "ShortName");
  sp.set("pagination[page]", String(page));
  sp.set("pagination[pageSize]", String(pageSize));
  sp.set("sort", sort);

  if (identifier) {
    sp.set("filters[$or][0][MailIdentifier][$eqi]", identifier);
    sp.set("filters[$or][1][MailIdentifier][$containsi]", identifier);
    sp.set("filters[$or][2][Firstname][$containsi]", identifier);
    sp.set("filters[$or][3][Lastname][$containsi]", identifier);
    sp.set("pagination[pageSize]", "10");
  } else if (queryTokens.length) {
    addTokenSearchFilters(sp, queryTokens);
  }

  if (label) {
    sp.set("filters[Phone][Label][$eq]", label);
  }

  async function fetchPeoplePage(pageNumber: number, size: number) {
    const pageParams = new URLSearchParams(sp);
    pageParams.set("pagination[page]", String(pageNumber));
    pageParams.set("pagination[pageSize]", String(size));

    const response = await fetch(`${STRAPI_URL}/api/people?${pageParams.toString()}`, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      throw new Error(JSON.stringify({ status: response.status, details: txt }));
    }

    return response.json();
  }

  let json: any;
  let items: any[];
  let paginationMeta: { page: number; pageSize: number; pageCount?: number; total?: number };

  try {
    json = await fetchPeoplePage(page, pageSize);
    items = (json.data || []).map((it: any) => normalizePersonItem(it));
    paginationMeta = json.meta?.pagination ?? { page, pageSize };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    let parsedStatus = 502;
    let parsedDetails = details;

    try {
      const parsed = JSON.parse(details);
      parsedStatus = Number(parsed.status) || 502;
      parsedDetails = parsed.details || details;
    } catch {}

    return Response.json({ error: `Strapi HTTP ${parsedStatus}`, details: parsedDetails }, { status: 502 });
  }

  // Secretariats are relation targets and may be returned without fully populated components
  // depending on Strapi populate resolution. Resolve them explicitly by documentId.
  const secretariatDocumentIds: string[] = Array.from(
    new Set(
      items
        .flatMap((p: any) => p.Secretariats || [])
        .map((s: any) => clean(s?.documentId))
        .filter((id: string) => Boolean(id))
    )
  );

  if (secretariatDocumentIds.length) {
    const spSec = new URLSearchParams();
    spSec.set("status", "draft");
    secretariatDocumentIds.forEach((docId: string, i: number) =>
      spSec.set(`filters[documentId][$in][${i}]`, docId)
    );
    spSec.set("populate[Phone]", "*");
    spSec.set("populate[Mail]", "*");
    spSec.set("populate[Address]", "*");
    spSec.set("populate[PrimaryOrganization][fields][0]", "Name");
    spSec.set("populate[PrimaryOrganization][fields][1]", "ShortName");
    spSec.set("populate[Organizations][fields][0]", "Name");
    spSec.set("populate[Organizations][fields][1]", "ShortName");
    spSec.set("pagination[page]", "1");
    spSec.set("pagination[pageSize]", String(Math.min(200, secretariatDocumentIds.length)));

    const secUrl = `${STRAPI_URL}/api/people?${spSec.toString()}`;
    const sr = await fetch(secUrl, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      cache: "no-store",
    });

    if (sr.ok) {
      const sjson = await sr.json();
      const detailedSecretariats = new Map<string, any>();
      for (const row of sjson.data || []) {
        const norm = normalizePersonRef(row);
        const key = clean(norm?.documentId);
        if (key) detailedSecretariats.set(key, norm);
      }

      for (const person of items) {
        person.Secretariats = (person.Secretariats || []).map((s: any) => {
          const key = clean(s?.documentId);
          return (key && detailedSecretariats.get(key)) || s;
        });
      }
    }
  }

  const itemsWithPubs = items.map((p: any) => ({
    ...p,
    Publications: [],
  }));

  if (!identifier && queryTokens.length) {
    itemsWithPubs.sort((a: any, b: any) => {
      const scoreA = scorePersonMatch(a, queryTokens, q);
      const scoreB = scorePersonMatch(b, queryTokens, q);
      if (scoreA !== scoreB) return scoreB - scoreA;

      const lastA = clean(a.Lastname).toLowerCase();
      const lastB = clean(b.Lastname).toLowerCase();
      if (lastA !== lastB) return lastA.localeCompare(lastB);

      return clean(a.Firstname).toLowerCase().localeCompare(clean(b.Firstname).toLowerCase());
    });
  }

  return Response.json({
    items: itemsWithPubs,
    pagination: paginationMeta,
  });
}
