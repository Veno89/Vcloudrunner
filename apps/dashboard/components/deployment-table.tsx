interface DeploymentItem {
  id: string;
  project: string;
  status: string;
  commitSha: string;
  createdAt: string;
}

export function DeploymentTable({ deployments }: { deployments: DeploymentItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900 text-slate-300">
          <tr>
            <th className="px-3 py-2">Deployment</th>
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Commit</th>
            <th className="px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody className="bg-slate-950 text-slate-100">
          {deployments.map((item) => (
            <tr key={item.id} className="border-t border-slate-800">
              <td className="px-3 py-2">{item.id}</td>
              <td className="px-3 py-2">{item.project}</td>
              <td className="px-3 py-2">{item.status}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.commitSha}</td>
              <td className="px-3 py-2 text-xs text-slate-400">{item.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
