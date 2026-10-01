// Turns a share link a person pastes (Sheets/Docs/Drive "Copy link") into
// its embeddable iframe form. Anything else is used as-is, so a direct
// embed URL still works.
export function toEmbeddableUrl(url: string): string {
  const sheets = url.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (sheets) return `https://docs.google.com/spreadsheets/d/${sheets[1]}/preview`;
  const docs = url.match(/docs\.google\.com\/document\/d\/([^/]+)/);
  if (docs) return `https://docs.google.com/document/d/${docs[1]}/preview`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return url;
}
