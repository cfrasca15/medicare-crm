"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  linkContactToGoogleCard,
  previewGoogleContactsSync,
  pushContactToGoogle,
  runGoogleContactsSync,
  type GoogleSyncResult,
  type PushResult,
} from "@/lib/googleContactsSync";
import { NAME_ONLY, type GoogleCandidate } from "@/lib/googleContactsMatch";

function refresh(contactId?: string) {
  revalidatePath("/settings/google");
  revalidatePath("/contacts");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
}

const failed = (err: unknown): PushResult => ({ error: err instanceof Error ? err.message : String(err) });

// Errors come back as a value: a production build hides the text of thrown ones.
export async function syncContactsToGoogle(): Promise<{ sync?: GoogleSyncResult; error?: string }> {
  try {
    return { sync: await runGoogleContactsSync() };
  } catch (err) {
    return failed(err);
  } finally {
    refresh();
  }
}

// What a sync would do, changing nothing in Google.
export async function previewContactsToGoogle(): Promise<{ sync?: GoogleSyncResult; error?: string }> {
  try {
    return { sync: await previewGoogleContactsSync() };
  } catch (err) {
    return failed(err);
  } finally {
    refresh();
  }
}

export async function setGoogleAutoSync(on: boolean): Promise<void> {
  await prisma.googleAccount.updateMany({ data: { contactsAutoSync: on } });
  revalidatePath("/settings/google");
}

// "Add to Google" on a contact; createAnyway is "Add as new" after a match was offered.
export async function addContactToGoogle(contactId: string, createAnyway = false): Promise<PushResult> {
  const result = await pushContactToGoogle(contactId, createAnyway).catch(failed);
  refresh(contactId);
  return result;
}

export async function linkContactToGoogle(contactId: string, resourceName: string): Promise<PushResult> {
  const result = await linkContactToGoogleCard(contactId, resourceName).catch(failed);
  refresh(contactId);
  return result;
}

// "Not in Google": the sync leaves this contact alone (and undoing that).
export async function setGoogleSyncSkip(contactId: string, skip: boolean): Promise<void> {
  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { googleSyncSkip: skip } }),
    ...(skip ? [prisma.googleContactReview.deleteMany({ where: { contactId } })] : []),
  ]);
  refresh(contactId);
}

// Links every review that's one Google contact with the same name.
export async function linkAllNameMatches(): Promise<{ linked: number; errors: string[] }> {
  const reviews = await prisma.googleContactReview.findMany({ where: { reason: NAME_ONLY } });
  let linked = 0;
  const errors: string[] = [];
  for (const r of reviews) {
    const candidates: GoogleCandidate[] = JSON.parse(r.candidatesJson);
    if (candidates.length !== 1) continue;
    const res = await linkContactToGoogleCard(r.contactId, candidates[0].resourceName).catch(failed);
    if (res.error) errors.push(res.error);
    else linked++;
  }
  refresh();
  return { linked, errors };
}
