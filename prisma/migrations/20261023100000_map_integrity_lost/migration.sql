-- Integrity's "Lost" stage comes through its API as status "Other" (code 51).
-- Show it as Lost, and send it and "Deceased" to the CRM's Lost stage.
UPDATE "IntegrityStageMapping" SET "label" = 'Lost' WHERE "label" = 'Other';

-- Make sure both statuses are listed even if no sync has seen them yet
-- (51 and 40 are Integrity's codes for them on this account).
INSERT OR IGNORE INTO "IntegrityStageMapping" ("code", "label", "pipelineStage", "updatedAt")
VALUES (51, 'Lost', 'LOST', strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now'));
INSERT OR IGNORE INTO "IntegrityStageMapping" ("code", "label", "pipelineStage", "updatedAt")
VALUES (40, 'Deceased', 'LOST', strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now'));

UPDATE "IntegrityStageMapping" SET "pipelineStage" = 'LOST'
WHERE "label" IN ('Lost', 'Deceased') AND "pipelineStage" IS NULL;

-- Contacts Integrity has as Lost or Deceased move to Lost.
UPDATE "Contact" SET "stage" = 'LOST'
WHERE "stage" <> 'LOST'
  AND "integrityLeadStage" IN (SELECT "code" FROM "IntegrityStageMapping" WHERE "label" IN ('Lost', 'Deceased'));
