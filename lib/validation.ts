import {
  ADDRESS_LABEL_OPTIONS,
  MAIL_LABEL_OPTIONS,
  PHONE_LABEL_OPTIONS,
  canonicalizeContactLabel,
} from "@/lib/contact-labels";
import { COUNTRY_OPTIONS } from "@/lib/countries";

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

export type SelfServicePayload = {
  ORCID?: string | null;
  Phone?: Phone[] | null;
  Mail?: Mail[] | null;
  Address?: Address[] | null;
};

export type ValidationErrors = {
  orcid?: string;
  phones?: Record<number, string>;
  mails?: Record<number, string>;
  addresses?: Record<number, string>;
};

const ALLOWED_PHONE_LABELS = new Set<string>(PHONE_LABEL_OPTIONS.map((option) => option.value));
const ALLOWED_MAIL_LABELS = new Set<string>(MAIL_LABEL_OPTIONS.map((option) => option.value));
const ALLOWED_ADDRESS_LABELS = new Set<string>(ADDRESS_LABEL_OPTIONS.map((option) => option.value));
const ALLOWED_COUNTRIES = new Set<string>(COUNTRY_OPTIONS as readonly string[]);

function clean(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function digitCount(value: string) {
  return (value.match(/\d/g) || []).length;
}

function isPhoneCharactersValid(value: string) {
  return /^[\d\s+()/.-]+$/.test(value);
}

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isOrcidChecksumValid(value: string) {
  const compact = value.replace(/-/g, "");
  if (!/^\d{15}[\dX]$/.test(compact)) return false;

  let total = 0;
  for (let index = 0; index < 15; index += 1) {
    total = (total + Number(compact[index])) * 2;
  }

  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const checkDigit = result === 10 ? "X" : String(result);
  return compact[15] === checkDigit;
}

function isAddressEmpty(address: Address) {
  return ![
    address.Label,
    address.StreetName,
    address.StreetNumber,
    address.Zip,
    address.City,
    address.State,
    address.Country,
  ].some((value) => clean(value));
}

export function sanitizePhones(list: Phone[] = []) {
  return list
    .map((entry) => ({
      Label: canonicalizeContactLabel(clean(entry?.Label), PHONE_LABEL_OPTIONS) || null,
      Number: clean(entry?.Number) || null,
    }))
    .filter((entry) => entry.Label || entry.Number);
}

export function sanitizeMails(list: Mail[] = []) {
  return list
    .map((entry) => ({
      Label: canonicalizeContactLabel(clean(entry?.Label), MAIL_LABEL_OPTIONS) || null,
      Address: clean(entry?.Address) || null,
    }))
    .filter((entry) => entry.Label || entry.Address);
}

export function sanitizeAddresses(list: Address[] = []) {
  return list
    .map((entry) => ({
      Label: canonicalizeContactLabel(clean(entry?.Label), ADDRESS_LABEL_OPTIONS) || null,
      StreetName: clean(entry?.StreetName) || null,
      StreetNumber: clean(entry?.StreetNumber) || null,
      Zip: clean(entry?.Zip) || null,
      City: clean(entry?.City) || null,
      State: clean(entry?.State) || null,
      Country: ALLOWED_COUNTRIES.has(clean(entry?.Country)) ? clean(entry?.Country) : null,
    }))
    .filter((entry) => !isAddressEmpty(entry));
}

export function validateSelfServicePayload(payload: SelfServicePayload) {
  const errors: ValidationErrors = {};

  const orcid = clean(payload.ORCID);
  if (orcid) {
    if (!/^\d{4}-\d{4}-\d{4}-[\dX]$/.test(orcid)) {
      errors.orcid = "ORCID muss das Format 0000-0000-0000-0000 haben.";
    } else if (!isOrcidChecksumValid(orcid)) {
      errors.orcid = "ORCID-Prüfziffer ist ungültig.";
    }
  }

  (payload.Phone || []).forEach((entry, index) => {
    const number = clean(entry?.Number);
    const label = canonicalizeContactLabel(clean(entry?.Label), PHONE_LABEL_OPTIONS);
    if (!number && !label) return;
    if (!label || !ALLOWED_PHONE_LABELS.has(label)) {
      errors.phones ||= {};
      errors.phones[index] = "Bitte ein gültiges Label wählen.";
      return;
    }
    if (!number) {
      errors.phones ||= {};
      errors.phones[index] = "Bitte eine Telefonnummer eintragen.";
      return;
    }
    if (!isPhoneCharactersValid(number)) {
      errors.phones ||= {};
      errors.phones[index] = "Telefonnummer enthält unzulässige Zeichen.";
      return;
    }
    if (digitCount(number) < 5) {
      errors.phones ||= {};
      errors.phones[index] = "Telefonnummer muss mindestens 5 Ziffern enthalten.";
    }
  });

  (payload.Mail || []).forEach((entry, index) => {
    const address = clean(entry?.Address);
    const label = canonicalizeContactLabel(clean(entry?.Label), MAIL_LABEL_OPTIONS);
    if (!address && !label) return;
    if (!label || !ALLOWED_MAIL_LABELS.has(label)) {
      errors.mails ||= {};
      errors.mails[index] = "Bitte ein gültiges Label wählen.";
      return;
    }
    if (!address) {
      errors.mails ||= {};
      errors.mails[index] = "Bitte eine E-Mail-Adresse eintragen.";
      return;
    }
    if (!isEmailValid(address)) {
      errors.mails ||= {};
      errors.mails[index] = "Bitte eine gültige E-Mail-Adresse eintragen.";
    }
  });

  (payload.Address || []).forEach((entry, index) => {
    if (isAddressEmpty(entry)) return;
    const label = canonicalizeContactLabel(clean(entry?.Label), ADDRESS_LABEL_OPTIONS);
    const country = clean(entry?.Country);
    const streetName = clean(entry?.StreetName);
    const city = clean(entry?.City);

    if (!label || !ALLOWED_ADDRESS_LABELS.has(label)) {
      errors.addresses ||= {};
      errors.addresses[index] = "Bitte ein gültiges Label wählen.";
      return;
    }
    if (!streetName && !city) {
      errors.addresses ||= {};
      errors.addresses[index] = "Adresse benötigt mindestens Straße oder Ort.";
      return;
    }
    if (country && !ALLOWED_COUNTRIES.has(country)) {
      errors.addresses ||= {};
      errors.addresses[index] = "Bitte ein gültiges Land wählen.";
    }
  });

  return {
    errors,
    hasErrors: Boolean(
      errors.orcid ||
        (errors.phones && Object.keys(errors.phones).length) ||
        (errors.mails && Object.keys(errors.mails).length) ||
        (errors.addresses && Object.keys(errors.addresses).length)
    ),
    sanitized: {
      ORCID: orcid || null,
      Phone: sanitizePhones(payload.Phone || []),
      Mail: sanitizeMails(payload.Mail || []),
      Address: sanitizeAddresses(payload.Address || []),
    },
  };
}
