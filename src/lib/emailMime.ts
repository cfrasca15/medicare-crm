// Builds an outgoing email the way Gmail's own compose window does: your
// name on the From line, the message as formatted (HTML) mail with a plain
// text copy, and your Gmail signature underneath.

export interface MimeEmail {
  fromEmail: string;
  fromName?: string | null;
  to: string;
  subject: string;
  body: string; // plain text, as typed
  signatureHtml?: string | null; // from Gmail settings
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Typed text as Gmail would send it: one line per row, web links clickable.
function bodyToHtml(body: string): string {
  return escapeHtml(body)
    .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)"']/g, (url) => `<a href="${url}">${url}</a>`)
    .replace(/\r?\n/g, "<br>");
}

// The signature for the plain-text copy.
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|h[1-6])>/gi, "\n")
    .replace(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, text: string) => {
      const label = text.replace(/<[^>]+>/g, "").trim();
      return label && label !== href ? `${label} (${href})` : href;
    })
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Header text outside plain ASCII has to be encoded (RFC 2047).
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function fromHeader(email: string, name?: string | null): string {
  if (!name?.trim()) return email;
  const n = name.trim();
  return /^[\x20-\x7e]*$/.test(n) ? `"${n.replace(/["\\]/g, "\\$&")}" <${email}>` : `${encodeHeader(n)} <${email}>`;
}

// Base64 in 76-character lines, so long lines in a signature can't break the message.
const base64Lines = (s: string) => Buffer.from(s, "utf-8").toString("base64").replace(/.{1,76}/g, "$&\r\n");

export function buildMimeEmail(e: MimeEmail, boundary = `crm-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`): string {
  const sig = e.signatureHtml?.trim() || null;
  // Same markup Gmail uses, so it looks the same to whoever reads it.
  const html =
    `<div dir="ltr">${bodyToHtml(e.body)}` +
    (sig
      ? `<br clear="all"><div><br></div><span class="gmail_signature_prefix">-- </span><br>` +
        `<div dir="ltr" class="gmail_signature">${sig}</div>`
      : "") +
    `</div>`;
  const text = sig ? `${e.body}\r\n\r\n-- \r\n${htmlToText(sig).replace(/\n/g, "\r\n")}` : e.body;

  return [
    `From: ${fromHeader(e.fromEmail, e.fromName)}`,
    `To: ${e.to}`,
    `Subject: ${encodeHeader(e.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
