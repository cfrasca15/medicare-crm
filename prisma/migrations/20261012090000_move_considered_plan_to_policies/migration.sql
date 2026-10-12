-- The "Shopping For" boxes on a contact (insurance company, plan name, doctor,
-- medical group) are gone from the page. Plans typed there become policies so
-- they stay visible; a doctor or medical group with no plan becomes a note.
-- The old columns are left untouched.

-- A plan was entered: make it a policy, unless that contact already has a
-- policy for the same carrier and plan.
INSERT INTO "Policy" ("id", "contactId", "carrier", "planName", "doctor", "medicalGroup", "createdAt", "updatedAt")
SELECT
    'mig' || lower(hex(randomblob(11))),
    c."id",
    COALESCE(NULLIF(TRIM(c."insuranceCompany"), ''), 'Carrier not entered'),
    COALESCE(NULLIF(TRIM(c."planName"), ''), 'Plan name not entered'),
    NULLIF(TRIM(c."doctor"), ''),
    NULLIF(TRIM(c."medicalGroup"), ''),
    strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now'),
    strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')
FROM "Contact" c
WHERE (NULLIF(TRIM(c."insuranceCompany"), '') IS NOT NULL OR NULLIF(TRIM(c."planName"), '') IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "Policy" p
    WHERE p."contactId" = c."id"
      AND lower(TRIM(p."carrier")) = lower(COALESCE(NULLIF(TRIM(c."insuranceCompany"), ''), 'Carrier not entered'))
      AND lower(TRIM(p."planName")) = lower(COALESCE(NULLIF(TRIM(c."planName"), ''), 'Plan name not entered'))
  );

-- Only a doctor or medical group was entered: keep it as a note.
INSERT INTO "ContactNote" ("id", "contactId", "body", "createdAt")
SELECT
    'mig' || lower(hex(randomblob(11))),
    c."id",
    TRIM(
      CASE WHEN NULLIF(TRIM(c."doctor"), '') IS NOT NULL THEN 'Doctor: ' || TRIM(c."doctor") || '. ' ELSE '' END ||
      CASE WHEN NULLIF(TRIM(c."medicalGroup"), '') IS NOT NULL THEN 'Medical group: ' || TRIM(c."medicalGroup") || '. ' ELSE '' END
    ) || ' (Moved from the old Shopping For section.)',
    strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')
FROM "Contact" c
WHERE NULLIF(TRIM(c."insuranceCompany"), '') IS NULL
  AND NULLIF(TRIM(c."planName"), '') IS NULL
  AND (NULLIF(TRIM(c."doctor"), '') IS NOT NULL OR NULLIF(TRIM(c."medicalGroup"), '') IS NOT NULL);
