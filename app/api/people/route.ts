import { NextRequest } from "next/server";

const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";
const STRAPI_BASE = STRAPI_URL?.replace(/\/$/, "") || "";

function authHeaders() {
  return STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {};
}

function absUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${STRAPI_BASE}${url}`;
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

function normalizePublicationAuthor(input: any) {
  const attrs = input?.attributes ?? input;
  const pubRaw =
    attrs?.Publication?.data?.attributes
      ? { id: attrs.Publication.data.id, ...attrs.Publication.data.attributes }
      : attrs?.Publication ?? null;

  const personRaw =
    attrs?.Person?.data?.attributes
      ? { id: attrs.Person.data.id, ...attrs.Person.data.attributes }
      : attrs?.Person ?? null;

  return {
    id: input?.id ?? attrs?.id ?? null,
    AuthorName: attrs?.AuthorName ?? null,
    AuthorOrder: attrs?.AuthorOrder ?? null,
    IsCorresponding: attrs?.IsCorresponding ?? null,
    PersonId: personRaw?.id ?? null,
    Publication: pubRaw
      ? {
          id: pubRaw.id ?? null,
          Title: pubRaw.Title ?? null,
          Abstract: pubRaw.Abstract ?? null,
          DOI: pubRaw.DOI ?? null,
          Type: pubRaw.Type ?? null,
          PublishedDate: pubRaw.PublishedDate ?? null,
          Journal: pubRaw.Journal ?? null,
          Volume: pubRaw.Volume ?? null,
          Issue: pubRaw.Issue ?? null,
          Pages: pubRaw.Pages ?? null,
          URL: pubRaw.URL ?? null,
          Source: pubRaw.Source ?? null,
        }
      : null,
  };
}

/**
 * Assumes:
 * - Collection endpoint: /api/people  (adjust if yours is /api/persons)
 * - Fields: Title, Firstname, Lastname
 * - Repeatable component field: Phone (with Label, Number)
 */
export async function GET(req: NextRequest) {
  if (!STRAPI_URL) return Response.json({ error: "Missing STRAPI_URL" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const sort = searchParams.get("sort") || "Lastname:asc";
  const label = (searchParams.get("label") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") || "50") || 50));

  const sp = new URLSearchParams();
  sp.set("populate[Phone]", "*");
  sp.set("populate[Mail]", "*");
  sp.set("populate[Address]", "*");
  sp.set("populate[EmployeePicture]", "true");
  sp.set("pagination[page]", String(page));
  sp.set("pagination[pageSize]", String(pageSize));
  sp.set("sort", sort);

  if (q) {
    sp.set("filters[$or][0][Firstname][$containsi]", q);
    sp.set("filters[$or][1][Lastname][$containsi]", q);
  }

  // Filter by component label (repeatable)
  if (label) {
    sp.set("filters[Phone][Label][$eq]", label);
  }

  const url = `${STRAPI_URL}/api/people?${sp.toString()}`;

  const r = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    cache: "no-store",
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return Response.json({ error: `Strapi HTTP ${r.status}`, details: txt }, { status: 502 });
  }

  const json = await r.json();
  const raw = json.data || [];

  const items = raw.map((it: any) => {
    // v4: it.attributes, v5: Felder direkt auf it
    const attrs = it.attributes ?? it;

    return {
      id: it.id,
      Title: attrs.Title ?? attrs.title ?? null,
      Firstname: attrs.Firstname ?? attrs.firstname ?? null,
      Lastname: attrs.Lastname ?? attrs.lastname ?? null,
      Phone: attrs.Phone ?? attrs.phone ?? [], // repeatable component
      Mail: attrs.Mail ?? attrs.mail ?? [],
      Address: attrs.Address ?? attrs.address ?? [],
      EmployeePicture: normalizeMedia(attrs.EmployeePicture ?? attrs.employeePicture ?? null),
    };
  });

  // Load publications via publication-authors and group by person
  const pubMap = new Map<number, any[]>();
  const ids = items.map((p: any) => p.id).filter(Boolean);
  if (ids.length) {
    const spPub = new URLSearchParams();
    ids.forEach((id, i) => spPub.set(`filters[Person][id][$in][${i}]`, String(id)));
    spPub.set("populate[Publication]", "true");
    spPub.set("populate[Person]", "true");
    spPub.set("pagination[page]", "1");
    spPub.set("pagination[pageSize]", "200");
    spPub.set("sort[0]", "Publication.PublishedDate:desc");

    const pubUrl = `${STRAPI_URL}/api/publication-authors?${spPub.toString()}`;
    const pr = await fetch(pubUrl, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      cache: "no-store",
    });

    if (pr.ok) {
      const pjson = await pr.json();
      const praw = pjson.data || [];
      for (const pa of praw) {
        const norm = normalizePublicationAuthor(pa);
        const pid = norm.PersonId;
        if (!pid) continue;
        if (!pubMap.has(pid)) pubMap.set(pid, []);
        pubMap.get(pid)!.push(norm);
      }
      for (const list of pubMap.values()) {
        list.sort((a, b) => {
          const ad = a?.Publication?.PublishedDate || "";
          const bd = b?.Publication?.PublishedDate || "";
          return bd.localeCompare(ad);
        });
      }
    }
  }

  const itemsWithPubs = items.map((p: any) => ({
    ...p,
    Publications: pubMap.get(p.id) ?? [],
  }));

  return Response.json({
    items: itemsWithPubs,
    pagination: json.meta?.pagination ?? { page, pageSize },
  });
}
