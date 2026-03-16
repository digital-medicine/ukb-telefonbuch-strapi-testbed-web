export const PHONE_LABEL_OPTIONS = [
  { value: "Business", label: "Business" },
  { value: "Business Mobile", label: "Business Mobil" },
  { value: "Private", label: "Privat" },
  { value: "Private Mobile", label: "Privat Mobil" },
  { value: "Fax", label: "Fax" },
  { value: "Pager", label: "Pager" },
  { value: "Assistant", label: "Assistenz" },
  { value: "Other", label: "Sonstiges" },
] as const;

export const MAIL_LABEL_OPTIONS = [
  { value: "Business", label: "Business" },
  { value: "Private", label: "Privat" },
  { value: "Other", label: "Sonstiges" },
] as const;

export const ADDRESS_LABEL_OPTIONS = [
  { value: "Business", label: "Business" },
  { value: "Private", label: "Privat" },
  { value: "Other", label: "Sonstiges" },
] as const;

export function canonicalizeContactLabel(
  value: string | null | undefined,
  options: ReadonlyArray<{ value: string }>
) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "";
  const match = options.find((option) => option.value.trim().toLowerCase() === normalized);
  return match?.value || "";
}
