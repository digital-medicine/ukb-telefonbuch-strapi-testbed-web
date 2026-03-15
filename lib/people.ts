/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";

const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";
const STRAPI_BASE = STRAPI_URL?.replace(/\/$/, "") || "";

export type Phone = { Label?: string | null; Number?: string | null };
export type Mail = { Label?: string | null; Address?: string | null };
export type Address = {
  Label?: string | null;
  StreetName?: string | null;
  StreetNumber?: string | null;
  Zip?: string | null;
  City?: string | null;
  State?: string | null;
  Country?: string | null;
};

export type MediaFormat = { url?: string | null; width?: number | null; height?: number | null };
export type Media = {
  id?: number | null;
  url?: string | null;
  alternativeText?: string | null;
  formats?: Record<string, MediaFormat> | null;
};

export type OrganizationInfo = {
  id?: number | null;
  documentId?: string | null;
  Name?: string | null;
  ShortName?: string | null;
  AffiliationRole?: string | null;
  AffiliationPrimary?: boolean | null;
  LeadershipRoles?: string[] | null;
  LeadershipPrimary?: boolean | null;
  SortOrder?: number | null;
};

export type Secretariat = {
  id?: number | null;
  documentId?: string | null;
  Name?: string | null;
  MailIdentifier?: string | null;
  Email?: string | null;
  Phone?: string | null;
  Phones?: Phone[] | null;
  Mail?: Mail[] | null;
  Address?: Address[] | null;
  Organizations?: OrganizationInfo[] | null;
};

export type Publication = {
  id?: number | null;
  Title?: string | null;
  DOI?: string | null;
  Type?: string | null;
  PublishedDate?: string | null;
  Journal?: string | null;
  Volume?: string | null;
  Issue?: string | null;
  Pages?: string | null;
  URL?: string | null;
};

export type PublicationLink = {
  id?: number | null;
  PersonDocumentId?: string | null;
  Publication?: Publication | null;
};

export type Person = {
  id: number;
  documentId?: string | null;
  Title?: string | null;
  Firstname?: string | null;
  Lastname?: string | null;
  MailIdentifier?: string | null;
  ORCID?: string | null;
  WebexEnabled?: boolean | null;
  WebexEmail?: string | null;
  Secret?: string | null;
  Phone?: Phone[] | null;
  Mail?: Mail[] | null;
  Address?: Address[] | null;
  EmployeePicture?: Media | null;
  Secretariats?: Secretariat[] | null;
  Organizations?: OrganizationInfo[] | null;
  Publications?: PublicationLink[] | null;
};

function authHeaders(): Record<string, string> {
  if (!STRAPI_TOKEN) return {};
  return { Authorization: `Bearer ${STRAPI_TOKEN}` };
}

function clean(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
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

function absUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${STRAPI_BASE}${url}`;
}

function normalizeMedia(input: any): Media | null {
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
    url: absUrl(raw.url ?? null),
    alternativeText: raw.alternativeText ?? null,
    formats,
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
  const byKey = new Map<string, OrganizationInfo>();

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
      LeadershipRoles: [],
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
      LeadershipRoles: [],
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
      LeadershipRoles: [],
      LeadershipPrimary: false,
      SortOrder: Number(link.SortOrder ?? 100),
    };

    if (link.Role) existing.LeadershipRoles = [...(existing.LeadershipRoles || []), link.Role];
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

function normalizePersonRef(input: any): Secretariat | null {
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

  const mails = (attrs.Mail ?? attrs.mail ?? []) as Mail[];
  const phones = (attrs.Phone ?? attrs.phone ?? []) as Phone[];
  const addresses = (attrs.Address ?? attrs.address ?? []) as Address[];
  const organizations = (attrs.Organizations ?? attrs.organizations ?? [])
    .map((entry: any) => normalizeOrganizationRef(entry))
    .filter(Boolean);
  const primaryOrganization = normalizeOrganizationRef(
    attrs.PrimaryOrganization ?? attrs.primaryOrganization
  );
  const businessMail = mails.find((m) => clean(m?.Label).toLowerCase() === "business")?.Address || mails[0]?.Address || null;
  const businessPhone =
    phones.find((p) => clean(p?.Label).toLowerCase() === "business")?.Number ||
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

function normalizePublicationAuthor(input: any): PublicationLink {
  const attrs = input?.attributes ?? input;
  const pubRaw =
    attrs?.Publication?.data?.attributes
      ? { id: attrs.Publication.data.id, ...attrs.Publication.data.attributes }
      : attrs?.Publication ?? null;

  const personRaw =
    attrs?.Person?.data?.attributes
      ? { id: attrs.Person.data.id, documentId: attrs.Person.data.documentId, ...attrs.Person.data.attributes }
      : attrs?.Person ?? null;

  return {
    id: input?.id ?? attrs?.id ?? null,
    PersonDocumentId: personRaw?.documentId ?? null,
    Publication: pubRaw
      ? {
          id: pubRaw.id ?? null,
          Title: pubRaw.Title ?? null,
          DOI: pubRaw.DOI ?? null,
          Type: pubRaw.Type ?? null,
          PublishedDate: pubRaw.PublishedDate ?? null,
          Journal: pubRaw.Journal ?? null,
          Volume: pubRaw.Volume ?? null,
          Issue: pubRaw.Issue ?? null,
          Pages: pubRaw.Pages ?? null,
          URL: pubRaw.URL ?? null,
        }
      : null,
  };
}

async function strapiFetchJson(path: string, init?: RequestInit) {
  const response = await fetch(`${STRAPI_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Strapi HTTP ${response.status} ${text}`);
  }

  return response.json();
}

function buildPersonPopulateParams(includeSecret: boolean) {
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
  sp.set("populate[OrganizationLeadershipLinks][fields][0]", "Role");
  sp.set("populate[OrganizationLeadershipLinks][fields][1]", "Primary");
  sp.set("populate[OrganizationLeadershipLinks][fields][2]", "SortOrder");
  sp.set("populate[OrganizationLeadershipLinks][populate][Organization][fields][0]", "Name");
  sp.set("populate[OrganizationLeadershipLinks][populate][Organization][fields][1]", "ShortName");
  if (includeSecret) {
    sp.set("fields[0]", "Secret");
    sp.set("fields[1]", "Title");
    sp.set("fields[2]", "Firstname");
    sp.set("fields[3]", "Lastname");
    sp.set("fields[4]", "MailIdentifier");
    sp.set("fields[5]", "ORCID");
    sp.set("fields[6]", "WebexEnabled");
    sp.set("fields[7]", "WebexEmail");
    sp.set("fields[8]", "documentId");
  }
  return sp;
}

function normalizePerson(input: any, includeSecret: boolean): Person {
  const attrs = input?.attributes ?? input;
  const secretariats = (attrs.Secretariats ?? attrs.secretariats ?? [])
    .map((s: any) => normalizePersonRef(s))
    .filter(Boolean);
  const baseOrganizations = (attrs.Organizations ?? attrs.organizations ?? [])
    .map((entry: any) => normalizeOrganizationRef(entry))
    .filter(Boolean);
  const primaryOrganization = normalizeOrganizationRef(
    attrs.PrimaryOrganization ?? attrs.primaryOrganization
  );
  const leadershipLinks = (attrs.OrganizationLeadershipLinks ?? attrs.organizationLeadershipLinks ?? [])
    .map((entry: any) => normalizeLeadershipLink(entry))
    .filter(Boolean);
  const organizations = mergeOrganizations(baseOrganizations, primaryOrganization, leadershipLinks);

  return {
    id: input.id,
    documentId: input.documentId ?? attrs.documentId ?? null,
    Title: attrs.Title ?? attrs.title ?? null,
    Firstname: attrs.Firstname ?? attrs.firstname ?? null,
    Lastname: attrs.Lastname ?? attrs.lastname ?? null,
    MailIdentifier: attrs.MailIdentifier ?? attrs.mailIdentifier ?? null,
    ORCID: attrs.ORCID ?? attrs.orcid ?? null,
    WebexEnabled: Boolean(attrs.WebexEnabled ?? attrs.webexEnabled),
    WebexEmail: attrs.WebexEmail ?? attrs.webexEmail ?? null,
    Secret: includeSecret ? attrs.Secret ?? attrs.secret ?? null : null,
    Phone: attrs.Phone ?? attrs.phone ?? [],
    Mail: attrs.Mail ?? attrs.mail ?? [],
    Address: attrs.Address ?? attrs.address ?? [],
    EmployeePicture: normalizeMedia(attrs.EmployeePicture ?? attrs.employeePicture ?? null),
    Secretariats: secretariats,
    Organizations: organizations,
    Publications: [],
  };
}

async function fetchPublicationsForPerson(documentId: string) {
  const sp = new URLSearchParams();
  sp.set("filters[Person][documentId][$eq]", documentId);
  sp.set("populate[Publication]", "true");
  sp.set("populate[Person]", "true");
  sp.set("pagination[page]", "1");
  sp.set("pagination[pageSize]", "200");
  sp.set("sort[0]", "Publication.PublishedDate:desc");

  const json = await strapiFetchJson(`/api/publication-authors?${sp.toString()}`);
  const list = (json.data || []).map((row: any) => normalizePublicationAuthor(row));
  list.sort((a: PublicationLink, b: PublicationLink) => {
    const ad = a?.Publication?.PublishedDate || "";
    const bd = b?.Publication?.PublishedDate || "";
    return bd.localeCompare(ad);
  });
  return list;
}

export async function fetchPersonByDocumentId(documentId: string, options?: { includeSecret?: boolean }) {
  const includeSecret = Boolean(options?.includeSecret);
  const sp = buildPersonPopulateParams(includeSecret);
  const json = await strapiFetchJson(`/api/people/${documentId}?${sp.toString()}`);
  const raw = json.data ? unwrapEntity(json.data) : unwrapEntity(json);
  if (!raw) return null;
  const person = normalizePerson(raw, includeSecret);
  person.Publications = await fetchPublicationsForPerson(documentId);
  return person;
}

export async function updatePersonSecret(documentId: string, secretHash: string) {
  await strapiFetchJson(`/api/people/${documentId}?status=draft`, {
    method: "PUT",
    body: JSON.stringify({
      data: {
        Secret: secretHash,
      },
    }),
  });
}

export async function updatePersonSelfService(
  documentId: string,
  data: {
    ORCID?: string | null;
    Phone?: Phone[];
    Mail?: Mail[];
    Address?: Address[];
    EmployeePicture?: number | null;
  }
) {
  await strapiFetchJson(`/api/people/${documentId}?status=draft`, {
    method: "PUT",
    body: JSON.stringify({
      data,
    }),
  });
}

export async function uploadPersonPicture(documentId: string, file: File) {
  const formData = new FormData();
  formData.append("files", file);

  const response = await fetch(`${STRAPI_URL}/api/upload`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Upload HTTP ${response.status} ${text}`);
  }

  const uploaded = (await response.json()) as Array<{ id?: number | null }>;
  const fileId = uploaded?.[0]?.id;
  if (!fileId) {
    throw new Error("Upload returned no file id");
  }

  await updatePersonSelfService(documentId, { EmployeePicture: fileId });
  return fileId;
}

export function findBusinessMail(person: Pick<Person, "Mail">) {
  const list = person.Mail || [];
  return list.find((entry) => clean(entry?.Label).toLowerCase() === "business")?.Address?.trim() || null;
}

export function formatPersonName(person: Pick<Person, "Title" | "Firstname" | "Lastname">) {
  return [person.Title, person.Firstname, person.Lastname].filter(Boolean).join(" ").trim() || "(ohne Namen)";
}

export function hashSecret(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
