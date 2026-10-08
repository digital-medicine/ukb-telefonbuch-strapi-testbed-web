"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Manager = { linkId: string; personId: string; name: string; ldapUsername: string };
type OrganizationFunction = { linkId: string; personId: string; role: string; primary: boolean };
type Organization = {
  documentId: string;
  name: string;
  shortName?: string;
  parentId?: string | null;
  children: string[];
  memberCount: number;
  canDelete: boolean;
  managers: Manager[];
  functions: OrganizationFunction[];
};
type Person = { documentId: string; name: string; ldapUsername: string; organizations: string[]; primaryOrganization?: string | null; secretariats: { documentId: string; name: string }[] };
type SecretaryCandidate = { documentId: string; name: string; ldapUsername: string };
type ManagerCandidate = { documentId: string; name: string; ldapUsername: string };
type AssignedPerson = { documentId: string; name: string; ldapUsername: string; primaryOrganization: boolean; secretariats: { documentId: string; name: string }[] };

export default function AdminDirectory() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [serverQuery, setServerQuery] = useState("");
  const [peoplePage, setPeoplePage] = useState(1);
  const [peoplePagination, setPeoplePagination] = useState<{ page: number; pageCount: number; total: number } | null>(null);
  const [assignedPeople, setAssignedPeople] = useState<AssignedPerson[]>([]);
  const [assignedPage, setAssignedPage] = useState(1);
  const [assignedQuery, setAssignedQuery] = useState("");
  const [assignedServerQuery, setAssignedServerQuery] = useState("");
  const [assignedPagination, setAssignedPagination] = useState<{ page: number; pageCount: number; total: number } | null>(null);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedRefresh, setAssignedRefresh] = useState(0);
  const [personEditorTarget, setPersonEditorTarget] = useState("");
  const [secretariatTarget, setSecretariatTarget] = useState("");
  const [selectedSecretaryIds, setSelectedSecretaryIds] = useState<string[]>([]);
  const [secretariatQuery, setSecretariatQuery] = useState("");
  const [secretariatServerQuery, setSecretariatServerQuery] = useState("");
  const [secretariatPage, setSecretariatPage] = useState(1);
  const [secretariatCandidates, setSecretariatCandidates] = useState<SecretaryCandidate[]>([]);
  const [secretariatPagination, setSecretariatPagination] = useState<{ page: number; pageCount: number; total: number } | null>(null);
  const [secretariatLoading, setSecretariatLoading] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [managerServerSearch, setManagerServerSearch] = useState("");
  const [managerPage, setManagerPage] = useState(1);
  const [managerCandidates, setManagerCandidates] = useState<ManagerCandidate[]>([]);
  const [managerPagination, setManagerPagination] = useState<{ page: number; pageCount: number; total: number } | null>(null);
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerRefresh, setManagerRefresh] = useState(0);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [childName, setChildName] = useState("");
  const [childShortName, setChildShortName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshingPeople, setRefreshingPeople] = useState(false);
  const requestSequence = useRef(0);

  async function load(keepSelection = true, searchTerm = serverQuery, pageNumber = peoplePage) {
    const requestId = ++requestSequence.current;
    const initialLoad = organizations.length === 0;
    if (initialLoad) setLoading(true);
    else setRefreshingPeople(true);
    try {
      const params = new URLSearchParams({ q: searchTerm, page: String(pageNumber) });
      const response = await fetch(`/api/admin/organization-units?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verwaltungsdaten konnten nicht geladen werden.");
      if (requestId !== requestSequence.current) return;
      setOrganizations(data.organizations);
      setPeople(data.people);
      setPeoplePagination(data.peoplePagination || null);
      setSelected((current) => keepSelection && data.organizations.some((org: Organization) => org.documentId === current)
        ? current
        : data.organizations[0]?.documentId || "");
      setError("");
    } catch (loadError) {
      if (requestId === requestSequence.current) setError(loadError instanceof Error ? loadError.message : "Laden fehlgeschlagen.");
    } finally {
      if (requestId === requestSequence.current) {
        if (initialLoad) setLoading(false);
        setRefreshingPeople(false);
      }
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setServerQuery(query.trim());
      setPeoplePage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => { void load(true, serverQuery, peoplePage); }, [serverQuery, peoplePage]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    async function loadAssignedPeople() {
      setAssignedLoading(true);
      try {
        const params = new URLSearchParams({ mode: "organization-members", organizationId: selected, q: assignedServerQuery, page: String(assignedPage) });
        const response = await fetch(`/api/admin/organization-units?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Zugeordnete Personen konnten nicht geladen werden.");
        if (!cancelled) {
          setAssignedPeople(data.members || []);
          setAssignedPagination(data.pagination || null);
        }
      } catch (assignedError) {
        if (!cancelled) setError(assignedError instanceof Error ? assignedError.message : "Zugeordnete Personen konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setAssignedLoading(false);
      }
    }
    void loadAssignedPeople();
    return () => { cancelled = true; };
  }, [selected, assignedPage, assignedServerQuery, assignedRefresh]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAssignedServerQuery(assignedQuery.trim());
      setAssignedPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [assignedQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSecretariatServerQuery(secretariatQuery.trim());
      setSecretariatPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [secretariatQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setManagerServerSearch(managerSearch.trim());
      setManagerPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [managerSearch]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    async function loadManagerCandidates() {
      setManagerLoading(true);
      try {
        const params = new URLSearchParams({ mode: "manager-candidates", organizationId: selected, q: managerServerSearch, page: String(managerPage) });
        const response = await fetch(`/api/admin/organization-units?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Verwalterkandidaten konnten nicht geladen werden.");
        if (!cancelled) {
          setManagerCandidates(data.candidates || []);
          setManagerPagination(data.pagination || null);
        }
      } catch (candidateError) {
        if (!cancelled) setError(candidateError instanceof Error ? candidateError.message : "Verwalterkandidaten konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setManagerLoading(false);
      }
    }
    void loadManagerCandidates();
    return () => { cancelled = true; };
  }, [selected, managerServerSearch, managerPage, managerRefresh]);

  useEffect(() => {
    if (!secretariatTarget || !selected) return;
    let cancelled = false;
    async function loadMembers() {
      setSecretariatLoading(true);
      try {
        const params = new URLSearchParams({ mode: "organization-members", organizationId: selected, q: secretariatServerQuery, page: String(secretariatPage) });
        const response = await fetch(`/api/admin/organization-units?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Mitglieder konnten nicht geladen werden.");
        if (!cancelled) {
          setSecretariatCandidates(data.members || []);
          setSecretariatPagination(data.pagination || null);
        }
      } catch (candidateError) {
        if (!cancelled) setError(candidateError instanceof Error ? candidateError.message : "Mitglieder konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setSecretariatLoading(false);
      }
    }
    void loadMembers();
    return () => { cancelled = true; };
  }, [secretariatTarget, selected, secretariatServerQuery, secretariatPage]);

  const org = organizations.find((item) => item.documentId === selected);
  useEffect(() => {
    setName(org?.name || "");
    setShortName(org?.shortName || "");
    setManagerSearch("");
    setManagerServerSearch("");
    setManagerPage(1);
    setSecretariatTarget("");
    setSecretariatQuery("");
    setSecretariatServerQuery("");
    setAssignedQuery("");
    setAssignedServerQuery("");
    setAssignedPage(1);
  }, [selected, org?.name, org?.shortName]);

  const visiblePeople = people.filter((person) => !person.organizations.includes(selected) && person.primaryOrganization !== selected);
  const peopleSearchReady = Boolean(query.trim()) && serverQuery === query.trim();
  async function mutate(body: Record<string, unknown>, successMessage: string, keepSelection = true) {
    setBusy(String(body.action || body.personId || "save"));
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/organization-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Änderung konnte nicht gespeichert werden.");
      setNotice(successMessage);
      await load(keepSelection);
      if (body.action === "manager") setManagerRefresh((current) => current + 1);
      if (body.action === "membership" || body.action === "secretariat") {
        setAssignedPage(1);
        setAssignedRefresh((current) => current + 1);
      }
      if (body.action === "create-organization" && data.organizationId) setSelected(data.organizationId);
      return true;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Speichern fehlgeschlagen.");
      return false;
    } finally {
      setBusy("");
    }
  }

  function submitChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    void mutate({ action: "create-organization", organizationId: selected, name: childName, shortName: childShortName }, "Unterorganisation angelegt.").then((ok) => {
      if (ok) { setChildName(""); setChildShortName(""); }
    });
  }

  function deleteSelected() {
    if (!org || !window.confirm(`Unterorganisation „${org.name}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    void mutate({ action: "delete-organization", organizationId: selected }, "Unterorganisation gelöscht.", false);
  }

  if (loading && !organizations.length) return <p className="rounded-xl border border-[#dce2e9] bg-white p-5 text-[#344154]">Verwaltungsdaten werden geladen…</p>;
  if (!organizations.length) return <p className="rounded-xl border border-[#dce2e9] bg-white p-5 text-[#344154]">Keine verwaltbaren Organisationseinheiten gefunden.</p>;

  return <div className="grid gap-5 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.6fr)]">
    <aside className="rounded-2xl border border-[#dce2e9] bg-white p-4 shadow-sm">
      <h2 className="mb-3 mt-1 text-lg font-semibold">Meine Einheiten</h2>
      <div className="grid gap-1">{organizations.map((item) => <button key={item.documentId} onClick={() => setSelected(item.documentId)} className={`rounded-lg px-3 py-2 text-left text-sm ${selected === item.documentId ? "bg-[#e8f2f8] font-semibold text-[#0d4e74]" : "text-[#354154] hover:bg-[#f3f6f8]"}`}><span className="mr-1 text-[#7b8796]">{item.parentId ? "↳" : ""}</span>{item.shortName || item.name}</button>)}</div>
      {org && <div className="mt-5 border-t border-[#e8ecf0] pt-4"><h3 className="m-0 text-xs font-bold uppercase tracking-wide text-[#667386]">Verwalter dieser Einheit</h3><ul className="mb-0 mt-2 grid list-none gap-2 p-0">{org.managers.map((manager) => <li key={manager.personId} className="flex items-center justify-between gap-3 text-sm text-[#344154]"><span className="min-w-0"><span className="block truncate font-medium">{manager.name || manager.ldapUsername}</span><span className="block text-xs text-[#68768a]">{manager.ldapUsername}</span></span><button disabled={busy !== "" || org.managers.length <= 1} title={org.managers.length <= 1 ? "Mindestens ein Verwalter muss bleiben." : "Verwalterrecht entfernen"} onClick={() => void mutate({ action: "manager", organizationId: selected, personId: manager.personId, assigned: false }, "Verwalterrecht entfernt.")} className="rounded-md px-2 py-1 text-xs font-semibold text-[#9c3535] hover:bg-red-50 disabled:opacity-40">Entfernen</button></li>)}</ul>
        <div className="mt-3 grid gap-2 rounded-xl border border-[#e8ecf0] bg-[#f8fafc] p-3">
          <label className="grid gap-1 text-xs font-semibold text-[#526074]">Verwalter suchen
            <input value={managerSearch} onChange={(event) => setManagerSearch(event.target.value)} className="min-w-0 rounded-lg border border-[#cbd5df] bg-white px-3 py-2 text-sm text-[#182231]" placeholder="Nach Name suchen" />
          </label>
          {managerLoading ? <p className="m-0 text-xs text-[#68768a]">Suchergebnisse werden geladen…</p> : <div className="max-h-56 divide-y divide-[#e4e8ed] overflow-y-auto">
            {managerCandidates.map((person) => <button key={person.documentId} type="button" disabled={busy !== ""} onClick={() => void mutate({ action: "manager", organizationId: selected, personId: person.documentId, assigned: true }, "Verwalter hinzugefügt.")} className="flex w-full items-center justify-between gap-3 px-2 py-2 text-left text-sm text-[#202b3a] hover:bg-white disabled:opacity-50">
              <span className="truncate">{person.name}</span><span className="shrink-0 text-xs text-[#6b7788]">{person.ldapUsername}</span>
            </button>)}
            {!managerCandidates.length && <p className="m-0 px-2 py-3 text-sm text-[#68768a]">Keine passenden Personen mit LDAP-Kennung gefunden.</p>}
          </div>}
          {managerPagination && <div className="flex items-center justify-between gap-2 text-xs text-[#68768a]">
            <span>{managerPagination.total.toLocaleString("de-DE")} Treffer · {managerPagination.page}/{Math.max(1, managerPagination.pageCount)}</span>
            <span className="flex gap-2">
              <button type="button" disabled={managerPage <= 1 || managerLoading} onClick={() => setManagerPage((current) => Math.max(1, current - 1))} className="rounded border border-[#cbd5df] px-2 py-1 disabled:opacity-40">Zurück</button>
              <button type="button" disabled={managerPage >= managerPagination.pageCount || managerLoading} onClick={() => setManagerPage((current) => current + 1)} className="rounded border border-[#cbd5df] px-2 py-1 disabled:opacity-40">Weiter</button>
            </span>
          </div>}
        </div>
        <p className="mb-0 mt-2 text-xs leading-relaxed text-[#69778a]">Neue Verwalter erhalten Rechte nur für diese Einheit und ihre Untereinheiten.</p>
      </div>}
    </aside>

    <section className="min-w-0 rounded-2xl border border-[#dce2e9] bg-white p-4 shadow-sm sm:p-5">
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{notice}</p>}

      <form className="grid gap-3 border-b border-[#e8ecf0] pb-5" onSubmit={(event) => { event.preventDefault(); if (org) void mutate({ action: "update-organization", organizationId: selected, name, shortName }, "Organisationseinheit aktualisiert."); }}>
        <div><p className="m-0 text-xs font-bold uppercase tracking-wide text-[#667386]">Organisationseinheit</p><h2 className="mb-0 mt-1 text-xl font-semibold">{org?.name}</h2></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold text-[#526074]">Name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} className="rounded-lg border border-[#cbd5df] px-3 py-2 text-sm text-[#182231]" /></label><label className="grid gap-1 text-xs font-semibold text-[#526074]">Kurzname<input value={shortName} onChange={(event) => setShortName(event.target.value)} maxLength={80} className="rounded-lg border border-[#cbd5df] px-3 py-2 text-sm text-[#182231]" /></label></div>
        <div className="flex flex-wrap gap-2"><button disabled={busy !== "" || (name === org?.name && shortName === (org?.shortName || ""))} className="rounded-lg bg-[#145c86] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Änderungen speichern</button>{org?.canDelete && <button type="button" disabled={busy !== "" || org.children.length > 0 || org.memberCount > 0} onClick={deleteSelected} title={org.children.length ? "Erst Unterorganisationen entfernen." : org.memberCount ? "Erst Personen-Zuordnungen entfernen." : "Unterorganisation löschen"} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-[#9c3535] hover:bg-red-50 disabled:opacity-40">Unterorganisation löschen</button>}</div>
        {org?.canDelete && <p className="m-0 text-xs text-[#69778a]">Löschen ist nur möglich, wenn die Einheit keine Personen und Untereinheiten enthält.</p>}
      </form>

      <div className="border-b border-[#e8ecf0] py-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="m-0 text-base font-semibold">Zugeordnete Personen</h3><p className="mb-0 mt-1 text-sm text-[#68768a]">Mitgliedschaften, Funktionen und Sekretariatszuordnungen dieser Einheit.</p></div><label className="grid gap-1 text-xs font-semibold text-[#526074]">Zugeordnete Personen suchen<input value={assignedQuery} onChange={(event) => setAssignedQuery(event.target.value)} className="w-full rounded-lg border border-[#cbd5df] px-3 py-2 text-sm text-[#182231] sm:w-64" placeholder="Nach Name suchen" /></label></div>
        {assignedLoading ? <p className="py-5 text-sm text-[#68768a]">Zugeordnete Personen werden geladen…</p> : <div className="mt-3 divide-y divide-[#edf0f3]">{assignedPeople.map((person) => {
          const currentFunction = org?.functions.find((entry) => entry.personId === person.documentId)?.role || "";
          const roleLabels: Record<string, string> = { head: "Leitung", deputy: "Stellvertretung", scientific_lead: "Wissenschaftliche Leitung", administrative_lead: "Administrative Leitung", other: "Sonstige Funktion" };
          const isEditing = personEditorTarget === person.documentId;
          return <div key={person.documentId} className="my-2 rounded-lg border border-[#dce2e9] bg-white px-3 py-2.5 first:mt-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0"><span className="block truncate text-sm font-semibold text-[#202b3a]">{person.name}{person.primaryOrganization ? <span className="ml-2 rounded-full bg-[#e8f2f8] px-2 py-0.5 text-[10px] font-semibold text-[#145c86]">Hauptorganisation</span> : null}</span><span className="mt-0.5 block truncate text-xs text-[#6b7788]">{roleLabels[currentFunction] || "Keine Funktion"}{person.secretariats.length ? ` · Sekretariat: ${person.secretariats.map((secretary) => secretary.name).join(", ")}` : " · Kein Sekretariat"}</span></div>
              <button type="button" aria-expanded={isEditing} onClick={() => { setPersonEditorTarget(isEditing ? "" : person.documentId); setSecretariatTarget(""); }} className="shrink-0 rounded-md border border-[#cbd5df] px-2.5 py-1.5 text-xs font-semibold text-[#145c86] hover:bg-[#edf5fa]">{isEditing ? "Schließen" : "Bearbeiten"}</button>
            </div>
            {isEditing && <div className="mt-3 grid gap-3 border-t border-[#e8ecf0] pt-3 sm:grid-cols-[minmax(190px,1fr)_minmax(0,2fr)_auto] sm:items-end">
              <label className="grid gap-1 text-xs font-semibold text-[#526074]">Funktion
                <select value={currentFunction} disabled={busy !== ""} onChange={(event) => void mutate({ action: "function", organizationId: selected, personId: person.documentId, role: event.target.value }, "Funktion aktualisiert.")} className="w-full rounded-lg border border-[#cbd5df] bg-white px-3 py-2 text-sm text-[#182231]">
                  <option value="">Keine Funktion</option><option value="head">Leitung</option><option value="deputy">Stellvertretung</option><option value="scientific_lead">Wissenschaftliche Leitung</option><option value="administrative_lead">Administrative Leitung</option><option value="other">Sonstige Funktion</option>
                </select>
              </label>
              <div className="grid min-w-0 gap-1 text-xs text-[#526074]"><strong>Sekretariat</strong><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="min-w-0 flex-1 text-sm text-[#354154]">{person.secretariats.length ? person.secretariats.map((secretary) => secretary.name).join(", ") : "Keines zugeordnet"}</span><button type="button" onClick={() => { const opening = secretariatTarget !== person.documentId; setSecretariatTarget(opening ? person.documentId : ""); setSelectedSecretaryIds(opening ? person.secretariats.map((secretary) => secretary.documentId) : []); setSecretariatQuery(""); setSecretariatServerQuery(""); setSecretariatPage(1); }} className="shrink-0 rounded-lg border border-[#cbd5df] bg-white px-3 py-2 font-semibold text-[#145c86] hover:bg-[#edf5fa]">{secretariatTarget === person.documentId ? "Schließen" : person.secretariats.length ? "Ändern" : "Zuordnen"}</button></div></div>
              {!person.primaryOrganization && <button type="button" disabled={busy !== ""} onClick={() => { if (window.confirm(`${person.name} aus dieser Organisation entfernen?`)) void mutate({ action: "membership", organizationId: selected, personId: person.documentId, assigned: false }, "Personenzuordnung entfernt.").then((ok) => { if (ok) setPersonEditorTarget(""); }); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-[#9c3535] hover:bg-red-50 disabled:opacity-40 sm:justify-self-end">Aus Zuordnung entfernen</button>}
            </div>}
            {isEditing && secretariatTarget === person.documentId && <div className="mt-3 grid gap-2 rounded-xl border border-[#dce2e9] bg-[#fbfcfd] p-3 sm:max-w-2xl">
                <label className="grid gap-1 text-xs font-semibold text-[#526074]">Mitglied dieser Organisation suchen<input value={secretariatQuery} onChange={(event) => setSecretariatQuery(event.target.value)} className="rounded-lg border border-[#cbd5df] bg-white px-3 py-2 text-sm text-[#182231]" placeholder="Nach Name suchen" /></label>
                {secretariatLoading ? <p className="m-0 text-xs text-[#68768a]">Mitglieder werden geladen…</p> : <div className="max-h-52 divide-y divide-[#e4e8ed] overflow-y-auto">{secretariatCandidates.filter((candidate) => candidate.documentId !== person.documentId).map((candidate) => <label key={candidate.documentId} className="flex cursor-pointer items-center gap-3 px-2 py-2 text-sm text-[#202b3a] hover:bg-white"><input type="checkbox" checked={selectedSecretaryIds.includes(candidate.documentId)} disabled={busy !== ""} onChange={(event) => setSelectedSecretaryIds((current) => event.target.checked ? [...current, candidate.documentId] : current.filter((id) => id !== candidate.documentId))} className="h-4 w-4 shrink-0 accent-[#145c86]" /><span className="min-w-0 flex-1 truncate">{candidate.name}</span><span className="shrink-0 text-xs text-[#6b7788]">{candidate.ldapUsername}</span></label>)}{!secretariatCandidates.filter((candidate) => candidate.documentId !== person.documentId).length && <p className="m-0 px-2 py-3 text-sm text-[#68768a]">Keine passenden anderen Mitglieder gefunden.</p>}</div>}
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-[#68768a]">{selectedSecretaryIds.length} ausgewählt</span>{secretariatPagination && <div className="ml-auto flex items-center gap-2 text-xs text-[#68768a]"><span>{secretariatPagination.total.toLocaleString("de-DE")} Mitglieder · {secretariatPagination.page}/{Math.max(1, secretariatPagination.pageCount)}</span><button type="button" disabled={secretariatPage <= 1 || secretariatLoading} onClick={() => setSecretariatPage((current) => Math.max(1, current - 1))} className="rounded border border-[#cbd5df] px-2 py-1 disabled:opacity-40">Zurück</button><button type="button" disabled={secretariatPage >= secretariatPagination.pageCount || secretariatLoading} onClick={() => setSecretariatPage((current) => current + 1)} className="rounded border border-[#cbd5df] px-2 py-1 disabled:opacity-40">Weiter</button></div>}</div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8ecf0] pt-2"><button type="button" disabled={busy !== ""} onClick={() => setSelectedSecretaryIds([])} className="rounded-lg border border-[#cbd5df] bg-white px-3 py-2 text-xs font-semibold text-[#526074] hover:bg-[#f3f6f8]">Auswahl leeren</button><button type="button" disabled={busy !== ""} onClick={() => void mutate({ action: "secretariat", organizationId: selected, personId: person.documentId, secretariatIds: selectedSecretaryIds }, "Sekretariatszuordnung gespeichert.").then((ok) => { if (ok) setSecretariatTarget(""); })} className="rounded-lg bg-[#145c86] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0d4e74] disabled:opacity-50">Auswahl speichern</button></div>
              </div>}
          </div>;
        })}</div>}
        {!assignedLoading && !assignedPeople.length && <p className="py-5 text-sm text-[#667386]">{assignedQuery ? "Keine zugeordneten Personen für diese Suche gefunden." : "Dieser Organisation sind keine Personen zugeordnet."}</p>}
        {assignedPagination && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8ecf0] pt-4 text-sm text-[#596579]"><span>{assignedPagination.total.toLocaleString("de-DE")} zugeordnet · Seite {assignedPagination.page} von {Math.max(1, assignedPagination.pageCount)}</span><div className="flex gap-2"><button type="button" disabled={assignedPage <= 1 || assignedLoading} onClick={() => setAssignedPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#cbd5df] px-3 py-2 font-semibold text-[#263244] disabled:opacity-40">Zurück</button><button type="button" disabled={assignedPage >= assignedPagination.pageCount || assignedLoading} onClick={() => setAssignedPage((current) => current + 1)} className="rounded-lg border border-[#cbd5df] px-3 py-2 font-semibold text-[#263244] disabled:opacity-40">Weiter</button></div></div>}
      </div>

      <div className="pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="m-0 text-base font-semibold">Personen suchen und hinzufügen</h3><p className="mb-0 mt-1 text-sm text-[#68768a]">Hier werden nur noch nicht zugeordnete Personen angezeigt. Hauptorganisation bleibt unberührt.</p></div><label className="grid gap-1 text-xs font-semibold text-[#526074]">Personen suchen<input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-[#cbd5df] px-3 py-2 text-sm text-[#182231] sm:w-64" placeholder="Nach Name suchen" /></label></div>
        {!query.trim() && <p className="mb-0 mt-3 text-sm text-[#68768a]">Gib einen Namen ein, um Personen zu suchen.</p>}
        {query.trim() && !peopleSearchReady && <p role="status" className="mb-0 mt-3 text-xs text-[#68768a]">Suche wird vorbereitet…</p>}
        {peopleSearchReady && refreshingPeople && <p role="status" className="mb-0 mt-2 text-xs text-[#68768a]">Suchergebnisse werden aktualisiert…</p>}
        {peopleSearchReady && !refreshingPeople && <div className="mt-3 divide-y divide-[#e8ecf0]">{visiblePeople.map((person) => {
          return <div key={person.documentId} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0"><span className="block truncate text-sm font-medium text-[#202b3a]">{person.name}</span><span className="block truncate text-xs text-[#6b7788]">{person.ldapUsername || "LDAP-Kennung fehlt"}</span></span>
            <button type="button" disabled={busy !== ""} onClick={() => void mutate({ action: "membership", organizationId: selected, personId: person.documentId, assigned: true }, "Person zur Organisation hinzugefügt.")} className="shrink-0 rounded-md bg-[#145c86] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0d4e74] disabled:opacity-50">Hinzufügen</button>
          </div>;
        })}</div>}
        {peopleSearchReady && !refreshingPeople && !visiblePeople.length && <p className="py-6 text-sm text-[#667386]">Keine noch nicht zugeordneten Personen für diese Suche auf dieser Ergebnisseite.</p>}
        {peopleSearchReady && !refreshingPeople && peoplePagination && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8ecf0] pt-4 text-sm text-[#596579]">
          <span>Kontakte durchsucht · Seite {peoplePagination.page} von {Math.max(1, peoplePagination.pageCount)}</span>
          <div className="flex gap-2">
            <button type="button" disabled={peoplePage <= 1 || refreshingPeople || loading} onClick={() => setPeoplePage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#cbd5df] px-3 py-2 font-semibold text-[#263244] disabled:opacity-40">Zurück</button>
            <button type="button" disabled={peoplePage >= peoplePagination.pageCount || refreshingPeople || loading} onClick={() => setPeoplePage((current) => current + 1)} className="rounded-lg border border-[#cbd5df] px-3 py-2 font-semibold text-[#263244] disabled:opacity-40">Weiter</button>
          </div>
        </div>}
      </div>

      <form className="mt-6 grid gap-3 border-t border-[#e8ecf0] pt-5" onSubmit={submitChild}>
        <div><h3 className="m-0 text-base font-semibold">Unterorganisation anlegen</h3><p className="mb-0 mt-1 text-sm text-[#68768a]">Neue Einheit wird unter „{org?.name}“ eingeordnet.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold text-[#526074]">Name<input value={childName} onChange={(event) => setChildName(event.target.value)} required maxLength={200} className="rounded-lg border border-[#cbd5df] px-3 py-2 text-sm text-[#182231]" /></label><label className="grid gap-1 text-xs font-semibold text-[#526074]">Kurzname (optional)<input value={childShortName} onChange={(event) => setChildShortName(event.target.value)} maxLength={80} className="rounded-lg border border-[#cbd5df] px-3 py-2 text-sm text-[#182231]" /></label></div>
        <button disabled={busy !== "" || !childName.trim()} className="w-fit rounded-lg border border-[#cbd5df] bg-white px-3 py-2 text-sm font-semibold text-[#263244] disabled:opacity-50">Unterorganisation anlegen</button>
      </form>
    </section>
  </div>;
}
