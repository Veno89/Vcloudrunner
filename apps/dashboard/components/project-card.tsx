interface ProjectCardProps {
  name: string;
  repo: string;
  domain: string;
  status: string;
  buttonLabel?: string;
}

export function ProjectCard({ name, repo, domain, status, buttonLabel = 'Deploy' }: ProjectCardProps) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{name}</h3>
        <span className="rounded-full bg-slate-800 px-2 py-1 text-xs">{status}</span>
      </div>
      <p className="truncate text-xs text-slate-400">{repo}</p>
      <p className="mt-2 truncate text-xs text-cyan-400">{domain}</p>
      <div className="mt-3 rounded bg-cyan-600/20 px-3 py-1 text-xs font-medium text-cyan-200">{buttonLabel}</div>
    </article>
  );
}
