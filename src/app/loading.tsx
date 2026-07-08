import { Skeleton } from "@/components/ui/skeleton";

/** Route-transition loading state (§3.9) — skeleton grid shared by all pages. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-8 h-4 w-80" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border/60 bg-card"
          >
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-end justify-between">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-10 w-24" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
