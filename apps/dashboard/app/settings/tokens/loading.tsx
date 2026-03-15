export default function SettingsTokensLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-44 rounded bg-muted" />
        <div className="h-4 w-96 rounded bg-muted" />
      </div>

      <div className="flex gap-2">
        <div className="h-8 w-24 rounded bg-muted" />
        <div className="h-8 w-28 rounded bg-muted" />
      </div>

      <div className="rounded-lg border p-5 space-y-4">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="grid gap-2 md:grid-cols-[1fr_140px_180px_auto]">
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 rounded bg-muted" />
          <div className="h-24 rounded bg-muted" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-20 rounded border bg-muted/30" />
        <div className="h-20 rounded border bg-muted/30" />
      </div>
    </div>
  );
}
