export default function ProjectDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="h-5 w-48 animate-pulse rounded bg-muted" />
      <div>
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg border bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      <div className="h-72 animate-pulse rounded-lg border bg-muted" />
    </div>
  );
}
