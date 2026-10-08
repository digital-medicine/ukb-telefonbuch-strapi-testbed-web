import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/me";
  return <main className="mx-auto mt-16 max-w-md rounded-2xl border border-[#dce2e9] bg-white p-8 shadow-sm">
    <h1 className="mb-2 text-2xl font-semibold text-[#182231]">UKB Telefonbuch</h1>
    <p className="mb-6 text-sm text-[#596579]">Mit deinem UKB-Netzwerk-Konto anmelden.</p>
    <LoginForm next={safeNext} />
  </main>;
}
