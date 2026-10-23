-- Integrity's Contacted status starts new imports at Contacted (if no stage
-- was picked for it), and contacts with that status still at New Lead move to
-- Contacted, so CRM stages match Integrity.
UPDATE "IntegrityStageMapping" SET "pipelineStage" = 'CONTACTED'
WHERE "label" = 'Contacted' AND "pipelineStage" IS NULL;

UPDATE "Contact" SET "stage" = 'CONTACTED'
WHERE "stage" = 'NEW_LEAD'
  AND "integrityLeadStage" IN (SELECT "code" FROM "IntegrityStageMapping" WHERE "label" = 'Contacted');
