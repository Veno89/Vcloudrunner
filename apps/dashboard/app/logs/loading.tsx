export default function LogsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-12 animate-pulse rounded-md border bg-muted" />
      <div className="h-72 animate-pulse rounded-lg border bg-muted" />
    </div>
  );
}
