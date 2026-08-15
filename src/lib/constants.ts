export const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  APPOINTMENT_SET: "Appointment Set",
  SOA_SIGNED: "SOA Signed",
  APPLICATION_SUBMITTED: "Application Submitted",
  ENROLLED: "Enrolled",
  RENEWAL: "Renewal",
  LOST: "Lost",
};

export const STAGE_ORDER = Object.keys(STAGE_LABELS);

export const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  CONTACTED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  APPOINTMENT_SET: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  SOA_SIGNED: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  APPLICATION_SUBMITTED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  ENROLLED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  RENEWAL: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  LOST: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};
