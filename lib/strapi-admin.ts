import { currentLdapSession } from "@/lib/ldap-auth";

const base = process.env.STRAPI_URL?.replace(/\/$/, "");
const headers = {
  "Content-Type": "application/json",
  ...(process.env.STRAPI_TOKEN ? { Authorization: `Bearer ${process.env.STRAPI_TOKEN}` } : {}),
};

export async function strapiAdmin(path: string, init?: RequestInit) {
  if (!base || !process.env.STRAPI_TOKEN) throw new Error("Strapi server credentials are not configured");
  const response = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init?.headers }, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(`Strapi request failed (${response.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

export async function strapiAdminListAll(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  const first = await strapiAdmin(`${path}${separator}pagination[page]=1&pagination[pageSize]=100`);
  const rows: any[] = [...(first.data || [])];
  const pageCount = Number(first.meta?.pagination?.pageCount || 1);
  for (let start = 2; start <= pageCount; start += 5) {
    const pages = Array.from({ length: Math.min(5, pageCount - start + 1) }, (_, index) => start + index);
    const chunks = await Promise.all(pages.map((page) => strapiAdmin(`${path}${separator}pagination[page]=${page}&pagination[pageSize]=100`)));
    for (const chunk of chunks) rows.push(...(chunk.data || []));
  }
  return rows;
}

function relationItems(value: any): any[] {
  const relation = value?.data ?? value;
  if (Array.isArray(relation)) return relation.map((item) => item?.attributes ? { ...item.attributes, documentId: item.documentId ?? item.attributes.documentId } : item);
  if (relation && typeof relation === "object") return [relation.attributes ? { ...relation.attributes, documentId: relation.documentId ?? relation.attributes.documentId } : relation];
  return [];
}

function relationItem(value: any): any | null {
  return relationItems(value)[0] ?? null;
}

export async function hasOrganizationManagerAccess(username: string) {
  const personQuery = new URLSearchParams({
    status: "draft",
    "filters[LDAPUsername][$eqi]": username.trim(),
    "pagination[pageSize]": "2",
    "fields[0]": "LDAPUsername",
    "populate[ManagedOrganizations][fields][0]": "documentId",
  });
  const response = await strapiAdmin(`/api/people?${personQuery}`);
  return (response.data ?? []).some((person: any) => {
    const attrs = person.attributes ?? person;
    return String(attrs.LDAPUsername ?? "").trim().toLowerCase() === username.trim().toLowerCase()
      && relationItems(attrs.ManagedOrganizations).some((org: any) => Boolean(org.documentId ?? org.id));
  });
}

export async function getAuthenticatedPersonLabel(identity: { username: string; displayName: string }) {
  const fallbackName = identity.displayName.trim();
  try {
    const query = new URLSearchParams({
      status: "draft",
      "filters[LDAPUsername][$eqi]": identity.username.trim(),
      "pagination[pageSize]": "2",
      "fields[0]": "Title",
      "fields[1]": "Firstname",
      "fields[2]": "Lastname",
    });
    const response = await strapiAdmin(`/api/people?${query}`);
    if (response.data?.length === 1) {
      const person = response.data[0].attributes ?? response.data[0];
      const fullName = [person.Title, person.Firstname, person.Lastname]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(" ");
      if (fullName) return `${fullName} (${identity.username})`;
    }
  } catch (error) {
    console.error("Could not load authenticated person's directory name", error);
  }
  return `${fallbackName || identity.username} (${identity.username})`;
}

export async function getManagerOrganizationIds(username: string) {
  const query = new URLSearchParams({
    status: "draft",
    "populate[Managers][fields][0]": "LDAPUsername",
    "populate[Managers][fields][1]": "Firstname",
    "populate[Managers][fields][2]": "Lastname",
    "populate[LeadershipLinks][populate][Person][fields][0]": "LDAPUsername",
    "populate[LeadershipLinks][populate][Person][fields][1]": "Firstname",
    "populate[LeadershipLinks][populate][Person][fields][2]": "Lastname",
    "populate[LeadershipLinks][fields][0]": "Role",
    "populate[LeadershipLinks][fields][1]": "Primary",
    "populate[LeadershipLinks][fields][2]": "SortOrder",
    "populate[ParentOrganization][fields][0]": "documentId",
  });
  const rows = await strapiAdminListAll(`/api/organizations?${query}`);
  const byId = new Map(rows.map((row) => [String(row.documentId), row]));
  const personQuery = new URLSearchParams({
    status: "draft",
    "filters[LDAPUsername][$eqi]": username.trim(),
    "pagination[pageSize]": "2",
    "fields[0]": "LDAPUsername",
    "populate[ManagedOrganizations][fields][0]": "documentId",
  });
  const matchedPeople = await strapiAdmin(`/api/people?${personQuery}`);
  const rootsFromPerson = (matchedPeople.data ?? []).flatMap((person: any) => {
    const attrs = person.attributes ?? person;
    if (String(attrs.LDAPUsername ?? "").trim().toLowerCase() !== username.trim().toLowerCase()) return [];
    return relationItems(attrs.ManagedOrganizations).map((org: any) => String(org.documentId ?? "")).filter(Boolean);
  });
  const rootsFromOrganizations = rows.filter((org) => relationItems(org.Managers ?? org.attributes?.Managers).some((person: any) =>
    String(person?.LDAPUsername ?? "").trim().toLowerCase() === username.trim().toLowerCase()
  )).map((org) => String(org.documentId));
  const roots = [...new Set([...rootsFromPerson, ...rootsFromOrganizations])];
  const allowed = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const org of rows) {
      const parent = relationItem(org.ParentOrganization ?? org.attributes?.ParentOrganization);
      const parentId = String(parent?.documentId || "");
      const id = String(org.documentId);
      if (parentId && allowed.has(parentId) && !allowed.has(id)) { allowed.add(id); changed = true; }
    }
  }
  return { rows, allowedIds: [...allowed], byId };
}

export async function getAdminIdentity() {
  const session = await currentLdapSession();
  if (!session) return null;
  const orgs = await getManagerOrganizationIds(session.username);
  return { session, ...orgs };
}
