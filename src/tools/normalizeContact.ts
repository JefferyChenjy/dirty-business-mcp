import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

import { normalizeWebsite } from "../utils/domain.js";

export const normalizeContactFieldsInputSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  default_country: z.string().length(2).optional(),
});

export type NormalizeContactFieldsInput = z.infer<typeof normalizeContactFieldsInputSchema>;

export function normalizeContactFieldsTool(input: NormalizeContactFieldsInput) {
  const normalizedPhone = normalizePhone(input.phone, input.default_country);
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedSite = normalizeWebsite(input.website);

  return {
    original: {
      phone: input.phone,
      email: input.email,
      website: input.website,
    },
    normalized: {
      phone: normalizedPhone.value,
      email: normalizedEmail.value,
      website: normalizedSite,
    },
    valid: {
      phone: normalizedPhone.valid,
      email: normalizedEmail.valid,
      website: Boolean(normalizedSite),
    },
  };
}

export function normalizePhone(phone?: string, defaultCountry?: string): {
  value?: string;
  valid: boolean;
} {
  if (!phone) {
    return { value: undefined, valid: false };
  }

  const raw = phone.trim();
  if (!raw) {
    return { value: undefined, valid: false };
  }

  const parsed = parsePhoneNumberFromString(raw, defaultCountry as never);
  if (!parsed || !parsed.isValid()) {
    return { value: undefined, valid: false };
  }

  return { value: parsed.number, valid: true };
}

export function normalizeEmail(email?: string): { value?: string; valid: boolean } {
  if (!email) {
    return { value: undefined, valid: false };
  }

  const value = email.trim().toLowerCase();
  if (!value) {
    return { value: undefined, valid: false };
  }

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
  return { value: valid ? value : undefined, valid };
}
