import { describe, expect, it } from "vitest";

import { canonicalizeContactLabel } from "@/lib/contact-labels";
import { ADDRESS_LABEL_OPTIONS, MAIL_LABEL_OPTIONS, PHONE_LABEL_OPTIONS } from "@/lib/contact-labels";
import { normalizeOrcid, validateSelfServicePayload } from "@/lib/validation";

describe("canonicalizeContactLabel", () => {
  it("normalisiert Telefonlabels casing-insensitiv", () => {
    expect(canonicalizeContactLabel("business mobile", PHONE_LABEL_OPTIONS)).toBe("Business Mobile");
    expect(canonicalizeContactLabel("PRIVATE", PHONE_LABEL_OPTIONS)).toBe("Private");
  });

  it("gibt leeren String bei unbekannten Werten zurück", () => {
    expect(canonicalizeContactLabel("unknown", MAIL_LABEL_OPTIONS)).toBe("");
  });
});

describe("normalizeOrcid", () => {
  it("normalisiert nackte ORCID-Werte ins Standardformat", () => {
    expect(normalizeOrcid("0000000236876165")).toBe("0000-0002-3687-6165");
  });

  it("akzeptiert ORCID-URLs und kleine x-Prüfziffern", () => {
    expect(normalizeOrcid("https://orcid.org/0000-0002-1694-233x")).toBe("0000-0002-1694-233X");
  });

  it("akzeptiert typografische Bindestriche", () => {
    expect(normalizeOrcid("0000–0002–3687–6165")).toBe("0000-0002-3687-6165");
  });
});

describe("validateSelfServicePayload", () => {
  it("akzeptiert eine gültige ORCID", () => {
    const result = validateSelfServicePayload({ ORCID: "0000-0002-3687-6165" });
    expect(result.hasErrors).toBe(false);
    expect(result.errors.orcid).toBeUndefined();
    expect(result.sanitized.ORCID).toBe("0000-0002-3687-6165");
  });

  it("meldet ORCIDs mit falscher Länge", () => {
    const result = validateSelfServicePayload({ ORCID: "0000-0002-3687" });
    expect(result.hasErrors).toBe(true);
    expect(result.errors.orcid).toBe("ORCID muss 16 Stellen enthalten.");
  });

  it("meldet ungültige ORCID-Prüfziffern", () => {
    const result = validateSelfServicePayload({ ORCID: "0000-0002-3687-6164" });
    expect(result.hasErrors).toBe(true);
    expect(result.errors.orcid).toBe("ORCID-Prüfziffer ist ungültig.");
  });

  it("verwirft Telefonnummern unter fünf Ziffern", () => {
    const result = validateSelfServicePayload({
      Phone: [{ Label: "Business", Number: "1234" }],
    });
    expect(result.hasErrors).toBe(true);
    expect(result.errors.phones?.[0]).toBe("Telefonnummer muss mindestens 5 Ziffern enthalten.");
  });

  it("akzeptiert typische Telefonnummernformate", () => {
    const result = validateSelfServicePayload({
      Phone: [{ Label: "business mobile", Number: "+49 (228) 123-4567" }],
    });
    expect(result.hasErrors).toBe(false);
    expect(result.sanitized.Phone).toEqual([{ Label: "Business Mobile", Number: "+49 (228) 123-4567" }]);
  });

  it("validiert E-Mail-Adressen und normalisiert Labels", () => {
    const result = validateSelfServicePayload({
      Mail: [{ Label: "private", Address: "max@example.org" }],
    });
    expect(result.hasErrors).toBe(false);
    expect(result.sanitized.Mail).toEqual([{ Label: "Private", Address: "max@example.org" }]);
  });

  it("verwirft leere Adressen und akzeptiert gültige Länder", () => {
    const result = validateSelfServicePayload({
      Address: [
        { Label: "", StreetName: "", City: "", Country: "" },
        { Label: "private", StreetName: "Musterstrasse", City: "Bonn", Country: "Germany" },
      ],
    });
    expect(result.hasErrors).toBe(false);
    expect(result.sanitized.Address).toEqual([
      {
        Label: "Private",
        StreetName: "Musterstrasse",
        StreetNumber: null,
        Zip: null,
        City: "Bonn",
        State: null,
        Country: "Germany",
      },
    ]);
  });

  it("meldet unvollständige Adressen", () => {
    const result = validateSelfServicePayload({
      Address: [{ Label: "Business", StreetName: "", City: "", Country: "Germany" }],
    });
    expect(result.hasErrors).toBe(true);
    expect(result.errors.addresses?.[0]).toBe("Adresse benötigt mindestens Straße oder Ort.");
  });

  it("meldet ungültige E-Mail-Adressen", () => {
    const result = validateSelfServicePayload({
      Mail: [{ Label: "Business", Address: "invalid" }],
    });
    expect(result.hasErrors).toBe(true);
    expect(result.errors.mails?.[0]).toBe("Bitte eine gültige E-Mail-Adresse eintragen.");
  });

  it("akzeptiert die gültigen Adresslabels", () => {
    expect(canonicalizeContactLabel("other", ADDRESS_LABEL_OPTIONS)).toBe("Other");
  });
});
