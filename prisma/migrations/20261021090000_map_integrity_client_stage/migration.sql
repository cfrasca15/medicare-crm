-- Integrity's "Client" status starts new imports at Current Client (only if
-- no stage was picked for it yet). Contacts already in the CRM move only
-- when "Apply to existing contacts" is clicked on the Integrity Stages page.
UPDATE "IntegrityStageMapping" SET "pipelineStage" = 'CURRENT_CLIENT'
WHERE "label" = 'Client' AND "pipelineStage" IS NULL;
