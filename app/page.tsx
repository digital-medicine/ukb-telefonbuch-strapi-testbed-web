import Directory from "./ui/Directory";

type SearchParams = {
  q?: string;
};

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolved = await searchParams;
  const initialQuery = (resolved.q ?? "").trim();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-6 text-[var(--ink)]">
      <h1 className="m-0 text-[34px] font-[750] tracking-[0.01em] text-[var(--ink)]">UKB Telefonbuch</h1>
      <p className="mb-[18px] mt-1 text-[var(--ink-soft)]">Suche &amp; Sortierung aus Strapi.</p>
      <Directory initialQuery={initialQuery} />
    </main>
  );
}
