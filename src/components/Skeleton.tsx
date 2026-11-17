// Grey placeholder shapes shown while something is still loading, so the
// page appears straight away instead of waiting on the slowest part.

const BAR = "rounded bg-slate-200 dark:bg-slate-800";

// A card with a few lines in it.
export function CardSkeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={`surface flex animate-pulse flex-col gap-3 p-4 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`${BAR} h-4`} style={{ width: `${[60, 85, 45, 75, 55][i % 5]}%` }} />
      ))}
    </div>
  );
}

// A whole page: a title, a line under it, and a block of content.
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="page animate-pulse">
      <div className="flex flex-col gap-2">
        <div className={`${BAR} h-7 w-48`} />
        <div className={`${BAR} h-4 w-80 max-w-full`} />
      </div>
      <div className="surface flex flex-col gap-3 p-4">
        {[70, 90, 55, 80, 65, 40].map((w, i) => (
          <div key={i} className={`${BAR} h-4`} style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}
