import Directory from "./ui/Directory";

export default function Page() {
  return (
    <main className="page">
      <h1 className="page-title">UKB Telefonbuch</h1>
      <p className="page-subtitle">Suche & Sortierung aus Strapi.</p>
      <Directory />
    </main>
  );
}
