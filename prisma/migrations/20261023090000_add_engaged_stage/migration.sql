-- New "Engaged" pipeline stage, matching Integrity's Engaged status. (The
-- stage column is plain text, so no schema change is needed.)

-- Integrity's Engaged status now starts new imports at Engaged, replacing the
-- earlier stand-in (Contacted) or no choice at all.
UPDATE "IntegrityStageMapping" SET "pipelineStage" = 'ENGAGED'
WHERE "label" = 'Engaged' AND ("pipelineStage" IS NULL OR "pipelineStage" = 'CONTACTED');

-- Contacts Integrity marks Engaged that are still at New Lead, or at Contacted
-- (where the old mapping put them), move to Engaged. Anyone further along is
-- left alone.
UPDATE "Contact" SET "stage" = 'ENGAGED'
WHERE "stage" IN ('NEW_LEAD', 'CONTACTED')
  AND "integrityLeadStage" IN (SELECT "code" FROM "IntegrityStageMapping" WHERE "label" = 'Engaged');
