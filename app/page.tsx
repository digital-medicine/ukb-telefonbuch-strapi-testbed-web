import Directory from "./ui/Directory";

type SearchParams = {
  q?: string;
};

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolved = await searchParams;
  const initialQuery = (resolved.q ?? "").trim();

  return (
    <main className="page">
      <h1 className="page-title">UKB Telefonbuch</h1>
      <p className="page-subtitle">Suche & Sortierung aus Strapi.</p>
      <Directory initialQuery={initialQuery} />
    </main>
  );
}
