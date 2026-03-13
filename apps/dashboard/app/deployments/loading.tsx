export default function DeploymentsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-muted" />
    </div>
  );
}
