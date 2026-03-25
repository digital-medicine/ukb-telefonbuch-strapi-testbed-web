"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ADDRESS_LABEL_OPTIONS,
  MAIL_LABEL_OPTIONS,
  PHONE_LABEL_OPTIONS,
  canonicalizeContactLabel,
} from "@/lib/contact-labels";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { normalizeOrcid, validateSelfServicePayload, type ValidationErrors } from "@/lib/validation";

type Phone = { Label?: string | null; Number?: string | null };
type Mail = { Label?: string | null; Address?: string | null };
type Address = {
  Label?: string | null;
  StreetName?: string | null;
  StreetNumber?: string | null;
  Zip?: string | null;
  City?: string | null;
  State?: string | null;
  Country?: string | null;
};

type Media = {
  url?: string | null;
  formats?: Record<string, { url?: string | null }> | null;
};

type Props = {
  documentId: string;
  token: string;
  initial: {
    ORCID?: string | null;
    Phone?: Phone[] | null;
    Mail?: Mail[] | null;
    Address?: Address[] | null;
    EmployeePicture?: Media | null;
  };
};

function emptyPhone(): Phone {
  return { Label: "", Number: "" };
}

function emptyMail(): Mail {
  return { Label: "", Address: "" };
}

function emptyAddress(): Address {
  return {
    Label: "",
    StreetName: "",
    StreetNumber: "",
    Zip: "",
    City: "",
    State: "",
    Country: "",
  };
}

export default function EditContactForm({ documentId, token, initial }: Props) {
  const normalizedInitialOrcid = normalizeOrcid(initial.ORCID || "");
  const normalizedInitialPhones = (initial.Phone || []).map((entry) => ({
    ...entry,
    Label: canonicalizeContactLabel(entry?.Label, PHONE_LABEL_OPTIONS) || "",
  }));
  const normalizedInitialMails = (initial.Mail || []).map((entry) => ({
    ...entry,
    Label: canonicalizeContactLabel(entry?.Label, MAIL_LABEL_OPTIONS) || "",
  }));
  const normalizedInitialAddresses = (initial.Address || []).map((entry) => ({
    ...entry,
    Label: canonicalizeContactLabel(entry?.Label, ADDRESS_LABEL_OPTIONS) || "",
  }));
  const normalizedInitialPayload = validateSelfServicePayload({
    ORCID: normalizedInitialOrcid,
    Phone: normalizedInitialPhones,
    Mail: normalizedInitialMails,
    Address: normalizedInitialAddresses,
  }).sanitized;

  const [orcid, setOrcid] = useState(normalizedInitialOrcid);
  const [phones, setPhones] = useState<Phone[]>(normalizedInitialPhones.length ? normalizedInitialPhones : [emptyPhone()]);
  const [mails, setMails] = useState<Mail[]>(normalizedInitialMails.length ? normalizedInitialMails : [emptyMail()]);
  const [addresses, setAddresses] = useState<Address[]>(
    normalizedInitialAddresses.length ? normalizedInitialAddresses : [emptyAddress()]
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(
    initial.EmployeePicture?.formats?.small?.url ||
      initial.EmployeePicture?.formats?.thumbnail?.url ||
      initial.EmployeePicture?.url ||
      null
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [baselineSnapshot, setBaselineSnapshot] = useState(() => JSON.stringify(normalizedInitialPayload));

  function inputClassName(hasError = false) {
    return hasError
      ? "w-full rounded-[10px] border border-[#c94b4b] bg-[linear-gradient(180deg,#fffdfd,#fff3f3)] px-3 py-2.5 text-[#111318] outline-none shadow-[0_0_0_3px_rgba(201,75,75,0.08)] transition focus:border-[#b72f2f] focus:ring-2 focus:ring-[rgba(201,75,75,0.18)]"
      : "w-full rounded-[10px] border border-[#d7dde4] bg-white px-3 py-2.5 text-[#111318] outline-none transition focus:border-[#1f6f5b] focus:ring-2 focus:ring-[rgba(31,111,91,0.18)]";
  }

  function clearOrcidError() {
    setValidationErrors((prev) => {
      if (!prev.orcid) return prev;
      return { ...prev, orcid: undefined };
    });
  }

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify(
        validateSelfServicePayload({
          ORCID: orcid,
          Phone: phones,
          Mail: mails,
          Address: addresses,
        }).sanitized
      ),
    [addresses, mails, orcid, phones]
  );

  const isDirty = currentSnapshot !== baselineSnapshot;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isDirty) {
      setMessage("Es gibt keine neuen Änderungen zum Speichern.");
      setError(null);
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    setValidationErrors({});

    const validation = validateSelfServicePayload({
      ORCID: orcid,
      Phone: phones,
      Mail: mails,
      Address: addresses,
    });

    if (validation.hasErrors) {
      setValidationErrors(validation.errors);
      setError("Bitte korrigiere die markierten Felder.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/people/${encodeURIComponent(documentId)}/self-service-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ORCID: validation.sanitized.ORCID,
          Phone: validation.sanitized.Phone,
          Mail: validation.sanitized.Mail,
          Address: validation.sanitized.Address,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | { error?: string; validation?: ValidationErrors }
        | null;
      if (!response.ok) {
        if (json?.validation) {
          setValidationErrors(json.validation);
        }
        throw new Error(json?.error || "Speichern fehlgeschlagen");
      }

      setBaselineSnapshot(JSON.stringify(validation.sanitized));
      setMessage("Die Änderungen wurden gespeichert. Du kannst jetzt zurück zum Profil.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;

    setUploadingPhoto(true);
    setPhotoMessage(null);
    setPhotoError(null);

    try {
      const body = new FormData();
      body.append("token", token);
      body.append("file", photoFile);

      const response = await fetch(`/api/people/${encodeURIComponent(documentId)}/self-service-photo`, {
        method: "POST",
        body,
      });

      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(json?.error || "Bild-Upload fehlgeschlagen");
      }

      setPhotoPreviewUrl(URL.createObjectURL(photoFile));
      setPhotoMessage("Das Bild wurde hochgeladen.");
      setPhotoFile(null);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Bild-Upload fehlgeschlagen");
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <form className="mt-[18px] grid gap-[18px]" onSubmit={handleSubmit}>
      <section className="rounded-[18px] border border-[var(--card-border)] bg-white p-[18px] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="mb-[14px] grid gap-1.5">
          <h2 className="m-0 text-[#111318]">Kontaktdaten bearbeiten</h2>
          <p className="m-0 text-[#4a4f5c]">Hier können E-Mail-Adressen, Telefonnummern, ORCID und Adressen gepflegt werden.</p>
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--card-border)] bg-white p-[18px] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="mb-[14px] flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="m-0 text-[#111318]">Profilbild</h3>
        </div>
        <div className="grid items-start gap-[18px] md:grid-cols-[180px_1fr]">
          <div className="grid h-[220px] w-[180px] place-items-center overflow-hidden rounded-[18px] border border-[#d7dde4] bg-[linear-gradient(180deg,#f2f5f7,#e9eef2)] font-semibold text-[#5f6675]">
            {photoPreviewUrl ? (
              <Image
                src={photoPreviewUrl}
                alt="Aktuelles Profilbild"
                width={180}
                height={220}
                sizes="180px"
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span>Kein Bild</span>
            )}
          </div>
          <div className="grid content-start gap-2.5">
            <label className="grid gap-1.5 text-[0.9rem] font-semibold text-[#4a4f5c]" htmlFor="profile-image">
              Neues Bild wählen
              <input
                id="profile-image"
                type="file"
                accept="image/*"
                className="w-full rounded-[10px] border border-[#d7dde4] bg-white px-3 py-2 text-[#111318] outline-none transition focus:border-[#1f6f5b] focus:ring-2 focus:ring-[rgba(31,111,91,0.18)]"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              type="button"
              className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-[linear-gradient(180deg,#ffffff,#f6fbf8)] px-4 py-[11px] font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-progress disabled:opacity-65"
              disabled={!photoFile || uploadingPhoto}
              onClick={handlePhotoUpload}
            >
              {uploadingPhoto ? "Lade Bild hoch..." : "Bild hochladen"}
            </button>
            {photoMessage ? <p className="m-0 text-[0.95rem] text-[var(--accent)]">{photoMessage}</p> : null}
            {photoError ? (
              <p className="m-0 rounded-xl border border-[#dc8d8d] bg-[linear-gradient(180deg,#fff5f5,#ffe9e9)] px-[14px] py-3 text-[0.95rem] font-bold text-[#8d1717] shadow-[0_8px_20px_rgba(163,34,34,0.08)]">
                {photoError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--card-border)] bg-white p-[18px] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="mb-[14px] flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="m-0 text-[#111318]">Telefonnummern</h3>
          <button type="button" className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-white px-3 py-2 font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => setPhones((prev) => [...prev, emptyPhone()])}>
            Telefonnummer hinzufügen
          </button>
        </div>
        <div className="grid gap-3">
          {phones.map((phone, index) => (
            <div className="grid gap-3 rounded-[14px] border border-[#e5e8ec] bg-[#fafbfc] p-[14px]" key={`phone-${index}`}>
              {validationErrors.phones?.[index] ? (
                <p className="m-0 rounded-xl border border-[#e5a4a4] bg-[linear-gradient(180deg,#fff2f2,#ffe4e4)] px-[14px] py-3 text-[0.92rem] font-bold leading-[1.45] text-[#971c1c] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]">{validationErrors.phones[index]}</p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Label</label>
                  <select
                    className={inputClassName(Boolean(validationErrors.phones?.[index]))}
                    value={phone.Label || ""}
                    onChange={(e) =>
                      setPhones((prev) => prev.map((row, i) => (i === index ? { ...row, Label: e.target.value } : row)))
                    }
                  >
                    <option value="">Bitte wählen</option>
                    {PHONE_LABEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Nummer</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.phones?.[index]))}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone.Number || ""}
                    onChange={(e) =>
                      setPhones((prev) => prev.map((row, i) => (i === index ? { ...row, Number: e.target.value } : row)))
                    }
                  />
                </div>
              </div>
              <button type="button" className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-white px-3 py-2 font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => setPhones((prev) => prev.filter((_, i) => i !== index))}>
                Entfernen
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--card-border)] bg-white p-[18px] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="mb-[14px] flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="m-0 text-[#111318]">E-Mail-Adressen</h3>
          <button type="button" className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-white px-3 py-2 font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => setMails((prev) => [...prev, emptyMail()])}>
            E-Mail hinzufügen
          </button>
        </div>
        <div className="grid gap-3">
          {mails.map((mail, index) => (
            <div className="grid gap-3 rounded-[14px] border border-[#e5e8ec] bg-[#fafbfc] p-[14px]" key={`mail-${index}`}>
              {validationErrors.mails?.[index] ? (
                <p className="m-0 rounded-xl border border-[#e5a4a4] bg-[linear-gradient(180deg,#fff2f2,#ffe4e4)] px-[14px] py-3 text-[0.92rem] font-bold leading-[1.45] text-[#971c1c] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]">{validationErrors.mails[index]}</p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Label</label>
                  <select
                    className={inputClassName(Boolean(validationErrors.mails?.[index]))}
                    value={mail.Label || ""}
                    onChange={(e) =>
                      setMails((prev) => prev.map((row, i) => (i === index ? { ...row, Label: e.target.value } : row)))
                    }
                  >
                    <option value="">Bitte wählen</option>
                    {MAIL_LABEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Adresse</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.mails?.[index]))}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    value={mail.Address || ""}
                    onChange={(e) =>
                      setMails((prev) => prev.map((row, i) => (i === index ? { ...row, Address: e.target.value } : row)))
                    }
                  />
                </div>
              </div>
              <button type="button" className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-white px-3 py-2 font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => setMails((prev) => prev.filter((_, i) => i !== index))}>
                Entfernen
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--card-border)] bg-white p-[18px] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="mb-[14px] flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="m-0 text-[#111318]">Adressen</h3>
          <button
            type="button"
            className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-white px-3 py-2 font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => setAddresses((prev) => [...prev, emptyAddress()])}
          >
            Adresse hinzufügen
          </button>
        </div>
        <div className="grid gap-3">
          {addresses.map((address, index) => (
            <div className="grid gap-3 rounded-[14px] border border-[#e5e8ec] bg-[#fafbfc] p-[14px]" key={`address-${index}`}>
              {validationErrors.addresses?.[index] ? (
                <p className="m-0 rounded-xl border border-[#e5a4a4] bg-[linear-gradient(180deg,#fff2f2,#ffe4e4)] px-[14px] py-3 text-[0.92rem] font-bold leading-[1.45] text-[#971c1c] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]">{validationErrors.addresses[index]}</p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Label</label>
                  <select
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    value={address.Label || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, Label: e.target.value } : row)))
                    }
                  >
                    <option value="">Bitte wählen</option>
                    {ADDRESS_LABEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Strasse</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    autoComplete="address-line1"
                    value={address.StreetName || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, StreetName: e.target.value } : row)))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Hausnummer</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    autoComplete="address-line2"
                    value={address.StreetNumber || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, StreetNumber: e.target.value } : row)))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">PLZ</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={address.Zip || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, Zip: e.target.value } : row)))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Ort</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    autoComplete="address-level2"
                    value={address.City || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, City: e.target.value } : row)))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Bundesland</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    autoComplete="address-level1"
                    value={address.State || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, State: e.target.value } : row)))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[0.9rem] font-semibold text-[#4a4f5c]">Land</label>
                  <select
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    value={address.Country || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, Country: e.target.value } : row)))
                    }
                  >
                    <option value="">Bitte wählen</option>
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-white px-3 py-2 font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => setAddresses((prev) => prev.filter((_, i) => i !== index))}
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--card-border)] bg-white p-[18px] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="mb-[14px] flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="m-0 text-[#111318]">ORCID</h3>
        </div>
        <div className="grid gap-1.5">
          <label className="text-[0.9rem] font-semibold text-[#4a4f5c]" htmlFor="orcid">
            ORCID
          </label>
          <input
            id="orcid"
            className={inputClassName(Boolean(validationErrors.orcid))}
            value={orcid}
            onChange={(e) => {
              setOrcid(e.target.value);
              clearOrcidError();
            }}
            onBlur={() => setOrcid((current) => normalizeOrcid(current))}
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="0000-0000-0000-0000"
          />
          {validationErrors.orcid ? <p className="mt-0.5 text-[0.88rem] leading-[1.35] text-[#a32222]">{validationErrors.orcid}</p> : null}
        </div>
      </section>

      <div className="grid gap-2.5">
        <button
          type="submit"
          className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#d4ddd9] bg-[linear-gradient(180deg,#ffffff,#f6fbf8)] px-4 py-[11px] font-semibold text-[#111318] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-progress disabled:opacity-65"
          disabled={saving || !isDirty}
        >
          {saving ? "Speichere..." : isDirty ? "Änderungen speichern" : "Keine Änderungen"}
        </button>
        {message ? (
          <div className="grid gap-2.5 rounded-[14px] border border-[#bfddd4] bg-[linear-gradient(180deg,#f4fcf8,#edf8f4)] px-4 py-[14px]">
            <p className="m-0 text-[0.95rem] text-[var(--accent)]">{message}</p>
            <div className="grid gap-2.5">
              <Link
                href={`/contact/${documentId}`}
                className="inline-flex w-fit items-center justify-center rounded-[10px] border border-[#c8ddd6] bg-white px-3 py-[9px] font-bold text-[#155b4d] no-underline hover:bg-[#f8fcfa]"
              >
                Zur Profilseite
              </Link>
              <p className="m-0 text-[0.9rem] text-[#476056]">Weitere Änderungen können jederzeit erneut gespeichert werden.</p>
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="m-0 rounded-xl border border-[#dc8d8d] bg-[linear-gradient(180deg,#fff5f5,#ffe9e9)] px-[14px] py-3 text-[0.95rem] font-bold text-[#8d1717] shadow-[0_8px_20px_rgba(163,34,34,0.08)]">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
