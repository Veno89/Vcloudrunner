import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormSubmitButton } from '@/components/form-submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProjectDomainAction } from '@/app/projects/actions';
import { DomainAddTip } from '@/components/onboarding/domain-tips';

interface AddDomainCardProps {
  projectId: string;
  expectedHost: string;
  canManageDomains: boolean;
  isAuthenticated: boolean;
}

export function AddDomainCard({
  projectId,
  expectedHost,
  canManageDomains,
  isAuthenticated
}: AddDomainCardProps) {
  if (canManageDomains) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1">Add Custom Domain <DomainAddTip /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={createProjectDomainAction} className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input type="hidden" name="projectId" value={projectId} readOnly />
            <input type="hidden" name="returnPath" value={`/projects/${projectId}/domains`} readOnly />
            <div className="space-y-2">
              <Label htmlFor="project-domain-host" className="sr-only">Custom domain host</Label>
              <Input
                id="project-domain-host"
                name="host"
                type="text"
                required
                placeholder="api.example.com"
                className="font-mono"
              />
            </div>
            <FormSubmitButton
              idleText="Add Domain"
              pendingText="Saving..."
              className="md:self-end"
            />
          </form>
          <p className="text-xs text-muted-foreground">
            Use an external hostname like <span className="font-mono text-foreground">api.example.com</span>. Platform-managed hosts under <span className="font-mono text-foreground">{expectedHost}</span> stay reserved and do not need to be added here.
          </p>
          <p className="text-xs text-muted-foreground">
            New custom hosts start with a TXT ownership challenge. Once the claim verifies and routing DNS is pointed at the platform target, the host still becomes live on the next successful deployment of the public service.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Custom Domain</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Domain management currently requires owner, admin, or project-admin access.
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
