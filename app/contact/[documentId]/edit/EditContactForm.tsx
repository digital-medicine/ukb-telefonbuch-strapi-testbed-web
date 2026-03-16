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
    return hasError ? "edit-input edit-input-error" : "edit-input";
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
    <form className="edit-form" onSubmit={handleSubmit}>
      <section className="edit-form-card">
        <div className="edit-form-header">
          <h2>Kontaktdaten bearbeiten</h2>
          <p>Hier können E-Mail-Adressen, Telefonnummern, ORCID und Adressen gepflegt werden.</p>
        </div>
      </section>

      <section className="edit-form-card">
        <div className="edit-section-title-row">
          <h3>Profilbild</h3>
        </div>
        <div className="edit-photo-block">
          <div className="edit-photo-preview">
            {photoPreviewUrl ? (
              <Image
                src={photoPreviewUrl}
                alt="Aktuelles Profilbild"
                width={180}
                height={220}
                sizes="180px"
                className="edit-photo-preview-image"
                unoptimized
              />
            ) : (
              <span>Kein Bild</span>
            )}
          </div>
          <div className="edit-photo-controls">
            <label className="edit-label" htmlFor="profile-image">
              Neues Bild wählen
            </label>
            <input
              id="profile-image"
              type="file"
              accept="image/*"
              className="edit-input"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            />
            <button type="button" className="edit-submit-button" disabled={!photoFile || uploadingPhoto} onClick={handlePhotoUpload}>
              {uploadingPhoto ? "Lade Bild hoch..." : "Bild hochladen"}
            </button>
            {photoMessage ? <p className="edit-request-success">{photoMessage}</p> : null}
            {photoError ? <p className="edit-request-error">{photoError}</p> : null}
          </div>
        </div>
      </section>

      <section className="edit-form-card">
        <div className="edit-section-title-row">
          <h3>Telefonnummern</h3>
          <button type="button" className="edit-add-button" onClick={() => setPhones((prev) => [...prev, emptyPhone()])}>
            Telefonnummer hinzufügen
          </button>
        </div>
        <div className="edit-stack">
          {phones.map((phone, index) => (
            <div className="edit-row-card" key={`phone-${index}`}>
              {validationErrors.phones?.[index] ? (
                <p className="edit-row-error">{validationErrors.phones[index]}</p>
              ) : null}
              <div className="edit-grid-two">
                <div className="edit-field-block">
                  <label className="edit-label">Label</label>
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
                <div className="edit-field-block">
                  <label className="edit-label">Nummer</label>
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
              <button type="button" className="edit-remove-button" onClick={() => setPhones((prev) => prev.filter((_, i) => i !== index))}>
                Entfernen
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="edit-form-card">
        <div className="edit-section-title-row">
          <h3>E-Mail-Adressen</h3>
          <button type="button" className="edit-add-button" onClick={() => setMails((prev) => [...prev, emptyMail()])}>
            E-Mail hinzufügen
          </button>
        </div>
        <div className="edit-stack">
          {mails.map((mail, index) => (
            <div className="edit-row-card" key={`mail-${index}`}>
              {validationErrors.mails?.[index] ? (
                <p className="edit-row-error">{validationErrors.mails[index]}</p>
              ) : null}
              <div className="edit-grid-two">
                <div className="edit-field-block">
                  <label className="edit-label">Label</label>
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
                <div className="edit-field-block">
                  <label className="edit-label">Adresse</label>
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
              <button type="button" className="edit-remove-button" onClick={() => setMails((prev) => prev.filter((_, i) => i !== index))}>
                Entfernen
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="edit-form-card">
        <div className="edit-section-title-row">
          <h3>Adressen</h3>
          <button
            type="button"
            className="edit-add-button"
            onClick={() => setAddresses((prev) => [...prev, emptyAddress()])}
          >
            Adresse hinzufügen
          </button>
        </div>
        <div className="edit-stack">
          {addresses.map((address, index) => (
            <div className="edit-row-card" key={`address-${index}`}>
              {validationErrors.addresses?.[index] ? (
                <p className="edit-row-error">{validationErrors.addresses[index]}</p>
              ) : null}
              <div className="edit-grid-address">
                <div className="edit-field-block">
                  <label className="edit-label">Label</label>
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
                <div className="edit-field-block">
                  <label className="edit-label">Strasse</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    autoComplete="address-line1"
                    value={address.StreetName || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, StreetName: e.target.value } : row)))
                    }
                  />
                </div>
                <div className="edit-field-block">
                  <label className="edit-label">Hausnummer</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    autoComplete="address-line2"
                    value={address.StreetNumber || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, StreetNumber: e.target.value } : row)))
                    }
                  />
                </div>
                <div className="edit-field-block">
                  <label className="edit-label">PLZ</label>
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
                <div className="edit-field-block">
                  <label className="edit-label">Ort</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    autoComplete="address-level2"
                    value={address.City || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, City: e.target.value } : row)))
                    }
                  />
                </div>
                <div className="edit-field-block">
                  <label className="edit-label">Bundesland</label>
                  <input
                    className={inputClassName(Boolean(validationErrors.addresses?.[index]))}
                    autoComplete="address-level1"
                    value={address.State || ""}
                    onChange={(e) =>
                      setAddresses((prev) => prev.map((row, i) => (i === index ? { ...row, State: e.target.value } : row)))
                    }
                  />
                </div>
                <div className="edit-field-block">
                  <label className="edit-label">Land</label>
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
                className="edit-remove-button"
                onClick={() => setAddresses((prev) => prev.filter((_, i) => i !== index))}
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="edit-form-card">
        <div className="edit-section-title-row">
          <h3>ORCID</h3>
        </div>
        <div className="edit-field-block">
          <label className="edit-label" htmlFor="orcid">
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
          {validationErrors.orcid ? <p className="edit-field-error">{validationErrors.orcid}</p> : null}
        </div>
      </section>

      <div className="edit-submit-row">
        <button type="submit" className="edit-submit-button" disabled={saving || !isDirty}>
          {saving ? "Speichere..." : isDirty ? "Änderungen speichern" : "Keine Änderungen"}
        </button>
        {message ? (
          <div className="edit-success-panel">
            <p className="edit-request-success">{message}</p>
            <div className="edit-success-actions">
              <Link href={`/contact/${documentId}`} className="edit-success-link">
                Zur Profilseite
              </Link>
              <p className="edit-success-note">Weitere Änderungen können jederzeit erneut gespeichert werden.</p>
            </div>
          </div>
        ) : null}
        {error ? <p className="edit-request-error">{error}</p> : null}
      </div>
    </form>
  );
}
