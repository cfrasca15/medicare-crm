-- The Documents, Benefits Grid and Formulary pages moved to Agent Compass;
-- their tables are no longer used. (Any uploaded files are left on disk in
-- the data volume's uploads folder.)
DROP TABLE IF EXISTS "FormularyPlan";
DROP TABLE IF EXISTS "FormularyDrug";
DROP TABLE IF EXISTS "Formulary";
DROP TABLE IF EXISTS "PlanDocument";
