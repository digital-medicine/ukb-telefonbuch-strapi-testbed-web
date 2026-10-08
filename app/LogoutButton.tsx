"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }
  return <button onClick={logout} className="rounded-lg border border-[#b9c3d0] px-3 py-2 font-semibold text-[#182231] hover:bg-[#f3f6f8]">Abmelden</button>;
}
