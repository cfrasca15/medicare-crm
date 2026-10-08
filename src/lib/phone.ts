/**
 * Google Voice's web dialer accepts a "new call" deep link
 * (https://voice.google.com/u/0/calls?a=nc,+1XXXXXXXXXX). This is an
 * unofficial, undocumented URL pattern (Google Voice has no public API for
 * placing calls) — it's worked reliably in practice but isn't guaranteed
 * to keep working if Google changes their web app.
 */
export function googleVoiceCallUrl(phone: string): string | null {
  const e164 = toE164(phone);
  if (!e164) return null;
  return `https://voice.google.com/u/0/calls?a=nc,${encodeURIComponent(e164)}`;
}

/**
 * The number to dial for a contact: the cell when it's marked preferred,
 * otherwise the main phone, falling back to whichever one exists.
 */
export function primaryPhone(contact: {
  phone: string | null;
  cellPhone: string | null;
  cellPreferred: boolean;
}): { number: string; isCell: boolean } | null {
  if (contact.cellPhone && (contact.cellPreferred || !contact.phone)) {
    return { number: contact.cellPhone, isCell: true };
  }
  return contact.phone ? { number: contact.phone, isCell: false } : null;
}

/** Formats a US phone number to E.164 (+1XXXXXXXXXX). Returns null if it doesn't look like a valid 10-digit US number. */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
