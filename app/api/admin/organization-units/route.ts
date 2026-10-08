import { NextRequest } from "next/server";
import { getAdminIdentity, strapiAdmin, strapiAdminListAll } from "@/lib/strapi-admin";

function addPeopleSearchFilters(query: URLSearchParams, value: string, andOffset = 0) {
  const tokens = value.split(/\s+/).map((token) => token.trim()).filter(Boolean).slice(0, 8);
  tokens.forEach((token, tokenIndex) => {
    const base = `filters[$and][${andOffset + tokenIndex}][$or]`;
    query.set(`${base}[0][Firstname][$containsi]`, token);
    query.set(`${base}[1][Lastname][$containsi]`, token);
    query.set(`${base}[2][LDAPUsername][$containsi]`, token);
  });
}

export async function GET(request: NextRequest) {
  try {
    const identity = await getAdminIdentity();
    if (!identity) return Response.json({ error: "Anmeldung erforderlich." }, { status: 401 });
    if (!identity.allowedIds.length) return Response.json({ error: "Für dieses Konto sind keine Organisationseinheiten freigegeben." }, { status: 403 });
    const params = request.nextUrl.searchParams;
    if (params.get("mode") === "organization-members") {
      const organizationId = params.get("organizationId") || "";
      if (!identity.allowedIds.includes(organizationId)) return Response.json({ error: "Nicht berechtigt." }, { status: 403 });
      const search = (params.get("q") || "").trim().slice(0, 160);
      const requestedPage = Number(params.get("page") || 1);
      const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(10000, requestedPage)) : 1;
      const memberQuery = new URLSearchParams({
        status: "draft",
        "pagination[page]": String(page),
        "pagination[pageSize]": "50",
        "sort[0]": "Lastname:asc",
        "sort[1]": "Firstname:asc",
        "fields[0]": "Firstname",
        "fields[1]": "Lastname",
        "fields[2]": "LDAPUsername",
        "populate[PrimaryOrganization][fields][0]": "documentId",
        "populate[Secretariats][fields][0]": "documentId",
        "populate[Secretariats][fields][1]": "Firstname",
        "populate[Secretariats][fields][2]": "Lastname",
        "filters[$and][0][$or][0][Organizations][documentId][$eq]": organizationId,
        "filters[$and][0][$or][1][PrimaryOrganization][documentId][$eq]": organizationId,
      });
      if (search) addPeopleSearchFilters(memberQuery, search, 1);
      const response = await strapiAdmin(`/api/people?${memberQuery}`);
      const members = (response.data || []).map((person: any) => {
        const attrs = person.attributes ?? person;
        return {
          documentId: person.documentId ?? attrs.documentId,
          name: [attrs.Firstname, attrs.Lastname].filter(Boolean).join(" "),
          ldapUsername: attrs.LDAPUsername ?? "",
          primaryOrganization: (attrs.PrimaryOrganization?.data ?? attrs.PrimaryOrganization)?.documentId === organizationId,
          secretariats: (attrs.Secretariats ?? []).map((secretary: any) => {
            const secretaryAttrs = secretary.attributes ?? secretary;
            return { documentId: secretary.documentId ?? secretaryAttrs.documentId, name: [secretaryAttrs.Firstname, secretaryAttrs.Lastname].filter(Boolean).join(" ") };
          }),
        };
      }).filter((person: any) => person.documentId && person.name);
      return Response.json({ members, pagination: response.meta?.pagination || { page, pageSize: 50, pageCount: 1, total: members.length } });
    }
    if (params.get("mode") === "manager-candidates") {
      const organizationId = params.get("organizationId") || "";
      if (!identity.allowedIds.includes(organizationId)) return Response.json({ error: "Nicht berechtigt." }, { status: 403 });
      const search = (params.get("q") || "").trim().slice(0, 160);
      const requestedPage = Number(params.get("page") || 1);
      const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(10000, requestedPage)) : 1;
      const candidatesQuery = new URLSearchParams({
        status: "draft",
        "pagination[page]": String(page),
        "pagination[pageSize]": "50",
        "sort[0]": "Lastname:asc",
        "sort[1]": "Firstname:asc",
        "filters[LDAPUsername][$notNull]": "true",
        "fields[0]": "Firstname",
        "fields[1]": "Lastname",
        "fields[2]": "LDAPUsername",
      });
      if (search) addPeopleSearchFilters(candidatesQuery, search);
      const response = await strapiAdmin(`/api/people?${candidatesQuery}`);
      const organization = identity.rows.find((row: any) => String(row.documentId) === organizationId);
      const managers = organization?.Managers ?? organization?.attributes?.Managers ?? [];
      const assignedIds = new Set(managers.map((manager: any) => String(manager.documentId ?? manager.attributes?.documentId ?? "")));
      const candidates = (response.data || []).map((person: any) => {
        const attrs = person.attributes ?? person;
        return {
          documentId: person.documentId ?? attrs.documentId,
          name: [attrs.Firstname, attrs.Lastname].filter(Boolean).join(" "),
          ldapUsername: attrs.LDAPUsername ?? "",
        };
      }).filter((person: any) => person.documentId && person.name && !assignedIds.has(person.documentId));
      return Response.json({ candidates, pagination: response.meta?.pagination || { page, pageSize: 50, pageCount: 1, total: candidates.length } });
    }
    const search = (params.get("q") || "").trim().slice(0, 160);
    const requestedPage = Number(params.get("page") || 1);
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(10000, requestedPage)) : 1;
    const peopleQuery = new URLSearchParams({
      status: "draft",
      "pagination[page]": String(page),
      "pagination[pageSize]": "50",
      "sort[0]": "Lastname:asc",
      "sort[1]": "Firstname:asc",
      "fields[0]": "Firstname", "fields[1]": "Lastname", "fields[2]": "LDAPUsername",
      "populate[Organizations][fields][0]": "documentId",
      "populate[PrimaryOrganization][fields][0]": "documentId",
      "populate[Secretariats][fields][0]": "documentId",
      "populate[Secretariats][fields][1]": "Firstname",
      "populate[Secretariats][fields][2]": "Lastname",
    });
    if (search) addPeopleSearchFilters(peopleQuery, search);
    const peopleResponse = await strapiAdmin(`/api/people?${peopleQuery}`);
    const peopleRows = peopleResponse.data || [];
    const people = peopleRows.map((row: any) => ({
      documentId: row.documentId,
      name: [row.Firstname ?? row.attributes?.Firstname, row.Lastname ?? row.attributes?.Lastname].filter(Boolean).join(" "),
      ldapUsername: row.LDAPUsername ?? row.attributes?.LDAPUsername ?? "",
      organizations: (row.Organizations ?? row.attributes?.Organizations ?? []).map((org: any) => org.documentId).filter(Boolean),
      primaryOrganization: (row.PrimaryOrganization ?? row.attributes?.PrimaryOrganization)?.documentId || null,
      secretariats: ((row.Secretariats ?? row.attributes?.Secretariats) || []).map((secretary: any) => {
        const attrs = secretary.attributes ?? secretary;
        return {
          documentId: secretary.documentId ?? attrs.documentId,
          name: [attrs.Firstname, attrs.Lastname].filter(Boolean).join(" "),
        };
      }).filter((secretary: any) => secretary.documentId),
    })).filter((person: any) => person.name);
    const organizations = identity.rows.filter((org: any) => identity.allowedIds.includes(String(org.documentId))).map((org: any) => ({
      documentId: org.documentId,
      name: org.Name ?? org.attributes?.Name,
      shortName: org.ShortName ?? org.attributes?.ShortName,
      parentId: (org.ParentOrganization ?? org.attributes?.ParentOrganization)?.documentId || null,
      canDelete: identity.allowedIds.includes(String((org.ParentOrganization ?? org.attributes?.ParentOrganization)?.documentId || "")),
      children: identity.rows.filter((candidate: any) => String((candidate.ParentOrganization ?? candidate.attributes?.ParentOrganization)?.documentId || "") === String(org.documentId)).map((candidate: any) => String(candidate.documentId)),
      memberCount: people.filter((person: any) => person.organizations.includes(String(org.documentId)) || person.primaryOrganization === String(org.documentId)).length,
      managers: ((org.Managers ?? org.attributes?.Managers) || []).map((person: any) => {
        if (!person) return null;
        const firstName = person.Firstname ?? person.attributes?.Firstname ?? "";
        const lastName = person.Lastname ?? person.attributes?.Lastname ?? "";
        return {
          personId: person.documentId ?? person.attributes?.documentId,
          name: [firstName, lastName].filter(Boolean).join(" "),
          ldapUsername: person.LDAPUsername ?? person.attributes?.LDAPUsername ?? "",
        };
      }).filter(Boolean),
      functions: ((org.LeadershipLinks ?? org.attributes?.LeadershipLinks) || []).map((link: any) => {
        const person = link.Person ?? link.attributes?.Person;
        const role = link.Role ?? link.attributes?.Role;
        if (!person || !role) return null;
        return {
          linkId: link.documentId ?? link.attributes?.documentId,
          personId: person.documentId ?? person.attributes?.documentId,
          role,
          primary: Boolean(link.Primary ?? link.attributes?.Primary),
        };
      }).filter(Boolean),
    }));
    return Response.json({ organizations, people, peoplePagination: peopleResponse.meta?.pagination || { page, pageSize: 50, pageCount: 1, total: people.length } });
  } catch (error) {
    console.error("Admin directory load failed", error);
    return Response.json({ error: "Verwaltungsdaten konnten nicht geladen werden." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await getAdminIdentity();
    if (!identity) return Response.json({ error: "Anmeldung erforderlich." }, { status: 401 });
    const body = await request.json().catch(() => null);
    const action = String(body?.action || "membership");
    const organizationId = String(body?.organizationId || "");

    if (action === "create-organization") {
      const parentId = organizationId;
      const name = String(body?.name || "").trim();
      const shortName = String(body?.shortName || "").trim();
      if (!identity.allowedIds.includes(parentId)) return Response.json({ error: "Für diese übergeordnete Einheit fehlen Rechte." }, { status: 403 });
      if (!name || name.length > 200 || shortName.length > 80) return Response.json({ error: "Bitte einen gültigen Namen (max. 200 Zeichen) angeben." }, { status: 400 });
      const created = await strapiAdmin("/api/organizations", { method: "POST", body: JSON.stringify({ data: { Name: name, ShortName: shortName || null, ParentOrganization: { connect: [parentId] } } }) });
      return Response.json({ ok: true, organizationId: created.data?.documentId });
    }

    if (!organizationId || !identity.allowedIds.includes(organizationId)) return Response.json({ error: "Nicht berechtigt." }, { status: 403 });

    if (action === "update-organization") {
      const name = String(body?.name || "").trim();
      const shortName = String(body?.shortName || "").trim();
      if (!name || name.length > 200 || shortName.length > 80) return Response.json({ error: "Bitte einen gültigen Namen (max. 200 Zeichen) angeben." }, { status: 400 });
      await strapiAdmin(`/api/organizations/${encodeURIComponent(organizationId)}?status=draft`, { method: "PUT", body: JSON.stringify({ data: { Name: name, ShortName: shortName || null } }) });
      return Response.json({ ok: true });
    }

    if (action === "delete-organization") {
      const org = identity.rows.find((row: any) => String(row.documentId) === organizationId);
      const parentId = String((org?.ParentOrganization ?? org?.attributes?.ParentOrganization)?.documentId || "");
      if (!parentId || !identity.allowedIds.includes(parentId)) return Response.json({ error: "Nur Unterorganisationen innerhalb des eigenen Verwaltungsbereichs können gelöscht werden." }, { status: 403 });
      const children = identity.rows.filter((row: any) => String((row.ParentOrganization ?? row.attributes?.ParentOrganization)?.documentId || "") === organizationId);
      if (children.length) return Response.json({ error: "Die Einheit enthält noch Unterorganisationen. Verschiebe oder lösche diese zuerst." }, { status: 409 });
      const members = await strapiAdmin(`/api/organizations/${encodeURIComponent(organizationId)}?status=draft&populate[Members][fields][0]=documentId&populate[PrimaryMembers][fields][0]=documentId`);
      const data = members.data ?? {};
      const memberCount = (data.Members ?? data.attributes?.Members ?? []).length + (data.PrimaryMembers ?? data.attributes?.PrimaryMembers ?? []).length;
      if (memberCount) return Response.json({ error: "Der Einheit sind noch Personen zugeordnet. Entferne diese Zuordnungen zuerst." }, { status: 409 });
      await strapiAdmin(`/api/organizations/${encodeURIComponent(organizationId)}?status=draft`, { method: "DELETE" });
      return Response.json({ ok: true });
    }

    const personId = String(body?.personId || "");
    const assigned = body?.assigned === true;
    if (!personId) return Response.json({ error: "Person fehlt." }, { status: 400 });

    if (action === "function") {
      const role = String(body?.role || "");
      const allowedRoles = new Set(["head", "deputy", "scientific_lead", "administrative_lead", "other"]);
      if (role && !allowedRoles.has(role)) return Response.json({ error: "Ungültige Funktion." }, { status: 400 });
      const personResponse = await strapiAdmin(`/api/people/${encodeURIComponent(personId)}?status=draft&populate[Organizations][fields][0]=documentId&populate[PrimaryOrganization][fields][0]=documentId`);
      const person = personResponse.data ?? {};
      const attrs = person.attributes ?? person;
      const memberships = attrs.Organizations ?? [];
      const primaryOrganization = attrs.PrimaryOrganization;
      const isMember = memberships.some((item: any) => String(item.documentId ?? item.id) === organizationId)
        || String(primaryOrganization?.documentId ?? primaryOrganization?.id ?? "") === organizationId;
      if (!isMember) return Response.json({ error: "Funktionen können nur Personen zugewiesen werden, die dieser Einheit zugeordnet sind." }, { status: 409 });

      const linksQuery = new URLSearchParams({
        "filters[Organization][documentId][$eq]": organizationId,
        "filters[Person][documentId][$eq]": personId,
      });
      const links = await strapiAdminListAll(`/api/organization-leaderships?${linksQuery}`);
      const existing = links[0];
      if (!role) {
        if (existing) {
          if (existing.CanManageAssignments ?? existing.attributes?.CanManageAssignments) {
            await strapiAdmin(`/api/organization-leaderships/${encodeURIComponent(existing.documentId)}`, { method: "PUT", body: JSON.stringify({ data: { Role: "other", Primary: false, SortOrder: 0 } }) });
          } else {
            await strapiAdmin(`/api/organization-leaderships/${encodeURIComponent(existing.documentId)}`, { method: "DELETE" });
          }
        }
      } else if (existing) {
        await strapiAdmin(`/api/organization-leaderships/${encodeURIComponent(existing.documentId)}`, { method: "PUT", body: JSON.stringify({ data: { Role: role } }) });
      } else {
        await strapiAdmin("/api/organization-leaderships", { method: "POST", body: JSON.stringify({ data: { Organization: { connect: [organizationId] }, Person: { connect: [personId] }, Role: role } }) });
      }
      return Response.json({ ok: true });
    }

    if (action === "secretariat") {
      const secretariatIds: string[] = [...new Set<string>((Array.isArray(body?.secretariatIds)
        ? body.secretariatIds
        : body?.secretariatId ? [body.secretariatId] : [])
        .map((id: unknown) => String(id).trim()).filter(Boolean))];
      if (secretariatIds.length > 50) return Response.json({ error: "Es können höchstens 50 Sekretariate zugeordnet werden." }, { status: 400 });
      if (secretariatIds.includes(personId)) return Response.json({ error: "Eine Person kann nicht ihr eigenes Sekretariat sein." }, { status: 400 });
      const targetUrl = `/api/people/${encodeURIComponent(personId)}?status=draft&populate[Organizations][fields][0]=documentId&populate[PrimaryOrganization][fields][0]=documentId`;
      const [targetResponse, ...secretaryResponses] = await Promise.all([
        strapiAdmin(targetUrl),
        ...secretariatIds.map((id) => strapiAdmin(`/api/people/${encodeURIComponent(id)}?status=draft&populate[Organizations][fields][0]=documentId&populate[PrimaryOrganization][fields][0]=documentId`)),
      ]);
      const belongsToOrganization = (response: any) => {
        const attrs = response?.data?.attributes ?? response?.data ?? {};
        const memberships = attrs.Organizations?.data ?? attrs.Organizations ?? [];
        const primary = attrs.PrimaryOrganization?.data ?? attrs.PrimaryOrganization;
        return (Array.isArray(memberships) && memberships.some((entry: any) => String(entry.documentId ?? entry.id ?? "") === organizationId))
          || String(primary?.documentId ?? primary?.id ?? "") === organizationId;
      };
      if (!belongsToOrganization(targetResponse)) return Response.json({ error: "Die Person ist dieser Organisation nicht zugeordnet." }, { status: 409 });
      if (secretaryResponses.some((response) => !belongsToOrganization(response))) return Response.json({ error: "Alle Sekretariate müssen Mitglieder derselben Organisation sein." }, { status: 409 });
      await strapiAdmin(`/api/people/${encodeURIComponent(personId)}?status=draft`, {
        method: "PUT",
        body: JSON.stringify({ data: { Secretariats: { set: secretariatIds } } }),
      });
      return Response.json({ ok: true });
    }

    if (action === "manager") {
      const personResponse = await strapiAdmin(`/api/people/${encodeURIComponent(personId)}?status=draft&fields[0]=LDAPUsername&fields[1]=Firstname&fields[2]=Lastname`);
      const person = personResponse.data ?? {};
      const attrs = person.attributes ?? person;
      if (!attrs.LDAPUsername) return Response.json({ error: "Für diese Person ist keine LDAP-Kennung hinterlegt." }, { status: 400 });
      const org = identity.rows.find((row: any) => String(row.documentId) === organizationId);
      const managers = org?.Managers ?? org?.attributes?.Managers ?? [];
      const alreadyAssigned = managers.some((manager: any) => String(manager.documentId ?? manager.attributes?.documentId ?? "") === personId);
      if (assigned) {
        if (!alreadyAssigned) {
          await strapiAdmin(`/api/organizations/${encodeURIComponent(organizationId)}?status=draft`, { method: "PUT", body: JSON.stringify({ data: { Managers: { connect: [personId] } } }) });
        }
      } else if (alreadyAssigned) {
        if (managers.length <= 1) return Response.json({ error: "Der letzte Verwalter kann nicht entfernt werden." }, { status: 409 });
        await strapiAdmin(`/api/organizations/${encodeURIComponent(organizationId)}?status=draft`, { method: "PUT", body: JSON.stringify({ data: { Managers: { disconnect: [personId] } } }) });
      }
      return Response.json({ ok: true });
    }

    await strapiAdmin(`/api/people/${encodeURIComponent(personId)}?status=draft`, {
      method: "PUT",
      body: JSON.stringify({ data: { Organizations: assigned ? { connect: [organizationId] } : { disconnect: [organizationId] } } }),
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Organization membership update failed", error);
    return Response.json({ error: "Zuordnung konnte nicht gespeichert werden." }, { status: 502 });
  }
}
