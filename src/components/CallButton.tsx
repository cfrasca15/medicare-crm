import { googleVoiceCallUrl } from "@/lib/phone";

export function CallButton({ phone }: { phone: string | null }) {
  if (!phone) return null;
  const url = googleVoiceCallUrl(phone);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Call via Google Voice"
      className="link text-xs whitespace-nowrap"
    >
      Call
    </a>
  );
}
