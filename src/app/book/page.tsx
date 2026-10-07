import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCalendlySchedulingUrl } from "@/lib/calendly";
import { CalendlySyncButton } from "@/components/CalendlySyncButton";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  const { contact: contactId } = await searchParams;

  const contact = contactId
    ? await prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : null;

  let schedulingUrl: string | null = null;
  let error: string | null = null;
  try {
    schedulingUrl = await getCalendlySchedulingUrl();
  } catch (err) {
    error = err instanceof Error ? err.message : "Couldn't load the booking page.";
  }

  // Calendly fills in its own form from these, so the client's name and
  // email don't have to be retyped.
  let embedUrl: string | null = null;
  if (schedulingUrl) {
    const url = new URL(schedulingUrl);
    url.searchParams.set("hide_gdpr_banner", "1");
    if (contact) {
      url.searchParams.set("name", `${contact.firstName} ${contact.lastName}`);
      if (contact.email) url.searchParams.set("email", contact.email);
    }
    embedUrl = url.toString();
  }

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
                {contact.email
                  ? " — name and email are filled in for you."
                  : " — no email on file, so type one in on the form."}
              </>
            ) : (
              "Open a contact and choose Book appointment to have their name and email filled in."
            )}
          </p>
        </div>
        <CalendlySyncButton />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {embedUrl && (
        <div className="surface overflow-hidden">
          <iframe
            src={embedUrl}
            title="Calendly booking page"
            className="h-[1050px] w-full border-0 bg-white"
          />
        </div>
      )}
    </div>
  );
}
