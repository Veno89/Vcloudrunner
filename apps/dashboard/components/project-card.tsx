import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProjectCardProps {
  name: string;
  repo: string;
  domain: string;
  status: string;
  buttonLabel?: string;
}

export function ProjectCard({ name, repo, domain, status }: ProjectCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{name}</CardTitle>
          <Badge variant={status === 'active' || status === 'running' ? 'success' : 'secondary'}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <p className="truncate text-muted-foreground">{repo}</p>
        <p className="truncate text-primary">{domain}</p>
      </CardContent>
    </Card>
  );
}
