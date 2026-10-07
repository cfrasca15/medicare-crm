import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listCalendlyEventTypes, type CalendlyEventType } from "@/lib/calendly";
import { CalendlySyncButton } from "@/components/CalendlySyncButton";
import { toE164 } from "@/lib/phone";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string; type?: string }>;
}) {
  const { contact: contactId, type: typeSlug } = await searchParams;

  const contact = contactId
    ? await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          altContactName: true,
          altContactPhone: true,
          altContactPreferred: true,
        },
      })
    : null;

  let eventTypes: CalendlyEventType[] = [];
  let error: string | null = null;
  try {
    eventTypes = await listCalendlyEventTypes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Couldn't load the booking page.";
  }
  const selected = eventTypes.find((t) => t.slug === typeSlug) ?? eventTypes[0] ?? null;

  // The number Chris should be calling: the contact person's when the client
  // is marked "call this person instead", otherwise the client's own.
  const useContactPerson = Boolean(contact?.altContactPreferred && contact.altContactPhone);
  const phone = useContactPerson ? contact?.altContactPhone : contact?.phone;
  const phoneDigits = phone ? toE164(phone)?.slice(1) : null;

  // Calendly fills in its own form from these, so the client's details
  // don't have to be retyped.
  let embedUrl: string | null = null;
  if (selected) {
    const url = new URL(selected.url);
    url.searchParams.set("hide_gdpr_banner", "1");
    if (contact) {
      url.searchParams.set("name", `${contact.firstName} ${contact.lastName}`);
      if (contact.email) url.searchParams.set("email", contact.email);
      if (phoneDigits && selected.phoneParam) url.searchParams.set(selected.phoneParam, phoneDigits);
    }
    embedUrl = url.toString();
  }

  const filled = contact
    ? [
        "name",
        contact.email ? "email" : null,
        phoneDigits && selected?.phoneParam
          ? useContactPerson
            ? `${contact.altContactName}'s phone number`
            : "phone number"
          : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Book an Appointment</h1>
          <p className="muted mt-1 text-sm">
            {contact ? (
              <>
                Booking for{" "}
                <Link href={`/contacts/${contact.id}`} className="link">
                  {contact.firstName} {contact.lastName}
                </Link>
                {` — filled in for you: ${filled.join(", ")}.`}
                {!contact.email && " No email on file, so type one in on the form."}
              </>
            ) : (
              "Open a contact and choose Book appointment to have their details filled in."
            )}
          </p>
        </div>
        <CalendlySyncButton />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {eventTypes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {eventTypes.map((t) => {
            const params = new URLSearchParams({
              ...(contact ? { contact: contact.id } : {}),
              type: t.slug,
            });
            return (
              <Link
                key={t.slug}
                href={`/book?${params}`}
                className={t.slug === selected?.slug ? "btn-primary" : "btn-secondary"}
              >
                {t.name}
              </Link>
            );
          })}
        </div>
      )}

      {embedUrl && (
        <div className="surface overflow-hidden">
          <iframe
            key={embedUrl}
            src={embedUrl}
            title="Calendly booking page"
            className="h-[1050px] w-full border-0 bg-white"
          />
        </div>
      )}
    </div>
  );
}
