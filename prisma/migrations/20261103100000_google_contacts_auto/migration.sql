-- Google Contacts runs on its own (every 30 minutes, on save) only once turned on.
ALTER TABLE "GoogleAccount" ADD COLUMN "contactsAutoSync" BOOLEAN NOT NULL DEFAULT false;
