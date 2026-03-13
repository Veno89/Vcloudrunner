export default function EnvironmentLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-12 animate-pulse rounded-md border bg-muted" />
      <div className="h-24 animate-pulse rounded-lg border bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-md border bg-muted" />
        ))}
      </div>
    </div>
  );
}
