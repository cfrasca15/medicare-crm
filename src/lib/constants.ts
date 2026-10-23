export const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  APPOINTMENT_SET: "Appointment Set",
  APPLICATION_SUBMITTED: "Application Submitted",
  ENROLLED: "Enrolled (new)",
  RETAINED: "Retained",
  CURRENT_CLIENT: "Current Client",
  LOST: "Lost",
};

export const STAGE_ORDER = Object.keys(STAGE_LABELS);

// Stages before an application exists. Recording a policy moves a contact
// out of these; existing clients (Current Client / Retained) are left alone.
export const PRE_APPLICATION_STAGES = ["NEW_LEAD", "CONTACTED", "APPOINTMENT_SET"];

// Starter suggestions for the plan form's Plan Type field, merged with what's
// already been typed. (Carrier and plan name choices live in src/lib/carriers.ts.)
export const PLAN_TYPE_SEED = ["MA", "MAPD", "PDP", "Med Supp", "HMO", "PPO", "SNP", "PFFS", "Cost Plan"];

export const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  CONTACTED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  APPOINTMENT_SET: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  APPLICATION_SUBMITTED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  ENROLLED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  RETAINED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  CURRENT_CLIENT: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  LOST: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};
