import { Badge } from '@/components/ui/badge';
import { formatRelativeTime, truncateUuid } from '@/lib/helpers';
import Link from 'next/link';

interface DeploymentItem {
  id: string;
  project: string;
  status: string;
  commitSha: string;
  createdAt: string;
}

function statusVariant(status: string) {
  if (status === 'running') return 'success' as const;
  if (status === 'building' || status === 'queued') return 'warning' as const;
  if (status === 'failed') return 'destructive' as const;
  return 'secondary' as const;
}

export function DeploymentTable({ deployments }: { deployments: DeploymentItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Deployment</th>
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Commit</th>
            <th className="px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((item) => (
            <tr key={item.id} className="border-t transition-colors hover:bg-accent/30">
              <td className="px-3 py-2">
                <Link
                  href={`/deployments/${item.id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {truncateUuid(item.id)}
                </Link>
              </td>
              <td className="px-3 py-2">{item.project}</td>
              <td className="px-3 py-2">
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{item.commitSha}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground" title={new Date(item.createdAt).toLocaleString()}>
                {formatRelativeTime(item.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
