import { PageSkeleton } from "@/components/Skeleton";

// Shown the moment a menu link is clicked, until that page's data is ready.
export default function Loading() {
  return <PageSkeleton />;
}
