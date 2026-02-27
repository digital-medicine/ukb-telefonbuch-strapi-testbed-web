import { redirect } from "next/navigation";

type Params = {
  identifier: string;
};

export default async function PersonDeepLinkPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const identifier = decodeURIComponent(resolved.identifier || "").trim();

  if (!identifier) {
    redirect("/");
  }

  redirect(`/?q=${encodeURIComponent(identifier)}`);
}
