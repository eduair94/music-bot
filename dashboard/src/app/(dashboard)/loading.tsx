/** Quiet placeholder while a dashboard page loads: the title row and a few ruled lines, pulsing. */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="flex items-end gap-5 border-b-2 border-ink px-4 pb-3 pt-4 sm:px-6">
        <div className="h-[46px] w-56 animate-pulse rounded-[4px] bg-ink/10 sm:h-[52px]" />
        <div className="mb-1 hidden h-4 w-44 animate-pulse rounded-[3px] bg-ink/[0.07] sm:block" />
      </div>
      <div className="grid gap-x-8 px-4 pt-8 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-t-2 border-ink/15 py-4">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-[4px] bg-ink/10" style={{ animationDelay: `${i * 90}ms` }} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-6 w-3/4 animate-pulse rounded-[3px] bg-ink/10" style={{ animationDelay: `${i * 90}ms` }} />
              <div className="h-3.5 w-1/3 animate-pulse rounded-[3px] bg-ink/[0.07]" style={{ animationDelay: `${i * 90}ms` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
