export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="h-4 w-80 rounded bg-muted" />
      </div>

      <div className="flex gap-2">
        <div className="h-8 w-24 rounded bg-muted" />
        <div className="h-8 w-28 rounded bg-muted" />
      </div>

      <div className="rounded-lg border p-5 space-y-4">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="h-4 w-96 rounded bg-muted" />
        <div className="h-9 w-28 rounded bg-muted" />
      </div>
    </div>
  );
}
