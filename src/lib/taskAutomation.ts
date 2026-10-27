import { prisma } from "@/lib/prisma";

// Calendly bookings come in as tasks (see calendlySync.ts). Once the
// appointment time has passed there's nothing left to do, so mark them done
// rather than leaving them to pile up as overdue.
export async function closePastAppointmentTasks(now = new Date()): Promise<{ closed: number }> {
  const { count } = await prisma.task.updateMany({
    where: { status: "OPEN", calendlyEventUri: { not: null }, dueDate: { lt: now } },
    data: { status: "DONE" },
  });
  return { closed: count };
}
