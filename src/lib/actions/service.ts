"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { SERVICE_CATEGORY_LABELS, statusLabel, WAITING_ON } from "@/lib/service";

function refresh(contactId: string) {
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/service");
  revalidatePath("/");
}

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const day = (v: FormDataEntryValue | null) => {
  const s = text(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null;
};

// "waiting:Carrier" -> status and waitingOn.
function parseStatus(v: string): { status: string; waitingOn: string | null } | null {
  if (v === "open" || v === "resolved") return { status: v, waitingOn: null };
  const w = v.startsWith("waiting:") ? v.slice(8) : "";
  return WAITING_ON.includes(w) ? { status: "waiting", waitingOn: w } : null;
}

export async function createServiceRequest(contactId: string, formData: FormData) {
  const category = text(formData.get("category"));
  const title = text(formData.get("title"));
  if (!SERVICE_CATEGORY_LABELS[category]) return { error: "Pick what kind of request it is." };
  if (!title) return { error: "Describe the issue." };
  const policyId = text(formData.get("policyId")) || null;
  const note = text(formData.get("note"));
  const status = parseStatus(text(formData.get("status")) || "open") ?? { status: "open", waitingOn: null };

  const request = await prisma.serviceRequest.create({
    data: {
      contactId,
      policyId,
      category,
      title,
      ...status,
      followUpOn: day(formData.get("followUpOn")),
    },
  });
  await prisma.activity.create({
    data: {
      contactId,
      serviceRequestId: request.id,
      type: "service",
      summary: `Opened: ${title} (${SERVICE_CATEGORY_LABELS[category]})${note ? `\n${note}` : ""}`,
    },
  });
  refresh(contactId);
}

// Adds a note and/or changes the status and follow-up date.
export async function updateServiceRequest(requestId: string, formData: FormData) {
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!request) return { error: "That request no longer exists." };
  const note = text(formData.get("note"));
  const next = parseStatus(text(formData.get("status"))) ?? { status: request.status, waitingOn: request.waitingOn };
  const followUpOn = formData.has("followUpOn") ? day(formData.get("followUpOn")) : request.followUpOn;
  const statusChanged = next.status !== request.status || next.waitingOn !== request.waitingOn;
  if (!note && !statusChanged && followUpOn?.getTime() === request.followUpOn?.getTime())
    return { error: "Add a note or change the status." };

  const resolved = next.status === "resolved";
  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      ...next,
      // Nothing left to follow up on once it's resolved.
      followUpOn: resolved ? null : followUpOn,
      resolvedAt: resolved ? (request.resolvedAt ?? new Date()) : null,
    },
  });
  const parts = [
    statusChanged ? (resolved ? "Resolved" : request.status === "resolved"
        ? next.status === "open"
          ? "Reopened"
          : `Reopened (${statusLabel(next)})`
        : statusLabel(next)) : null,
    note || null,
  ].filter(Boolean);
  if (parts.length)
    await prisma.activity.create({
      data: {
        contactId: request.contactId,
        serviceRequestId: requestId,
        type: "service",
        summary: `${request.title}: ${parts.join(" — ")}`,
      },
    });
  refresh(request.contactId);
}

export async function resolveServiceRequest(requestId: string) {
  const fd = new FormData();
  fd.set("status", "resolved");
  await updateServiceRequest(requestId, fd);
}

export async function deleteServiceRequest(requestId: string) {
  const request = await prisma.serviceRequest.delete({ where: { id: requestId } });
  refresh(request.contactId);
}
