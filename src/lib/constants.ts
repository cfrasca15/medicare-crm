export const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  APPOINTMENT_SET: "Appointment Set",
  APPLICATION_SUBMITTED: "Application Submitted",
  ENROLLED: "Enrolled",
  LOST: "Lost",
};

export const STAGE_ORDER = Object.keys(STAGE_LABELS);

// Starter suggestions for the Add Policy form's Carrier/Plan Type fields —
// merged with whatever's already been typed into existing policies, so the
// list grows with real usage instead of being a fixed, ever-stale set.
export const CARRIER_SEED = [
  "Aetna",
  "Humana",
  "UnitedHealthcare",
  "Cigna",
  "Blue Cross Blue Shield",
  "Elevance Health (Anthem)",
  "Wellcare",
  "Molina Healthcare",
  "Kaiser Permanente",
  "Devoted Health",
  "SCAN Health Plan",
];

export const PLAN_TYPE_SEED = ["MA", "MAPD", "PDP", "Med Supp", "HMO", "PPO", "SNP", "PFFS", "Cost Plan"];

export const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  CONTACTED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  APPOINTMENT_SET: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  APPLICATION_SUBMITTED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  ENROLLED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  LOST: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};
