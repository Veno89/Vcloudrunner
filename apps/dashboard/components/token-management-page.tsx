import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { ActionToast } from '@/components/action-toast';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import { SettingsSubnav } from '@/components/settings-subnav';
import { PageLayout } from '@/components/page-layout';
import {
  apiAuthToken,
  fetchApiTokensForUser,
  resolveViewerContext
} from '@/lib/api';
import { describeDashboardLiveDataFailure } from '@/lib/helpers';
import { createApiTokenAction, revokeApiTokenAction, rotateApiTokenAction } from '@/app/tokens/actions';

const scopeGroups: Array<{ label: string; description: string; scopes: string[] }> = [
  {
    label: 'Projects',
    description: 'Project listing and modification access.',
    scopes: ['projects:read', 'projects:write'],
  },
  {
    label: 'Deployments',
    description: 'Deployment history, trigger, and cancellation controls.',
    scopes: ['deployments:read', 'deployments:write', 'deployments:cancel'],
  },
  {
    label: 'Environment',
    description: 'Read and manage project environment variables.',
    scopes: ['environment:read', 'environment:write'],
  },
  {
    label: 'Logs',
    description: 'Read deployment and runtime logs.',
    scopes: ['logs:read'],
  },
  {
    label: 'Tokens',
    description: 'Read and manage API token lifecycle.',
    scopes: ['tokens:read', 'tokens:write'],
  },
];

interface TokenManagementPageProps {
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

export async function TokenManagementPage({ searchParams }: TokenManagementPageProps) {
  const tokenCookie = cookies().get('__token_plaintext');
  const tokenPlaintextFromCookie = tokenCookie?.value ?? null;
  if (tokenCookie) {
    cookies().delete('__token_plaintext');
  }

  let apiTokens: Array<{
    id: string;
    label: string | null;
    role: 'admin' | 'user';
    scopes: string[];
    tokenPreview: string;
    revokedAt: string | null;
    expiresAt: string | null;
  }> = [];
  let liveDataErrorMessage: string | null = null;
  let tokenListErrorMessage: string | null = null;
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (viewer) {
    try {
      const fetched = await fetchApiTokensForUser(viewer.userId);
      apiTokens = fetched.map((token) => ({
        id: token.id,
        label: token.label,
        role: token.role,
        scopes: token.scopes,
        tokenPreview: token.tokenPreview,
        revokedAt: token.revokedAt,
        expiresAt: token.expiresAt,
      }));
    } catch (error) {
      tokenListErrorMessage = describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: Boolean(viewer.userId),
        hasApiAuthToken: Boolean(apiAuthToken),
      });
    }
  } else {
    liveDataErrorMessage = describeDashboardLiveDataFailure({
      ...(viewerContextError ? { error: viewerContextError } : {}),
      hasDemoUserId: false,
      hasApiAuthToken: Boolean(apiAuthToken),
    });
  }

  return (
    <PageLayout>
      <PageHeader
        title="API Tokens"
        description="Create and manage API tokens for programmatic access."
      />

      <SettingsSubnav active="tokens" />

      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Token operation failed."
      />

      {tokenPlaintextFromCookie && (
        <div className="rounded-md border bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">
            Copy this token now. It will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded border bg-background px-3 py-2 font-mono text-xs text-foreground">
            {tokenPlaintextFromCookie}
          </code>
        </div>
      )}

      {!liveDataErrorMessage ? (
        <>
          {tokenListErrorMessage ? (
            <DemoModeBanner title="Partial outage" detail={tokenListErrorMessage}>
              Token inventory is temporarily unavailable, but you can still create new tokens.
            </DemoModeBanner>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Create Token</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={createApiTokenAction}
                className="space-y-4"
              >
                <div className="grid gap-2 md:grid-cols-[1fr_140px_180px_auto]">
                  <Label htmlFor="token-label" className="sr-only">Token label</Label>
                  <Input
                    id="token-label"
                    type="text"
                    name="label"
                    placeholder="Label (optional)"
                  />
                  <Label htmlFor="token-role" className="sr-only">Role</Label>
                  <Select
                    id="token-role"
                    name="role"
                    defaultValue="user"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </Select>
                  <Label htmlFor="token-expires-at" className="sr-only">Expiration date</Label>
                  <Input
                    id="token-expires-at"
                    type="datetime-local"
                    name="expiresAt"
                  />
                  <FormSubmitButton idleText="Create Token" pendingText="Creating..." />
                </div>
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-muted-foreground">
                    Scopes (leave unchecked for default)
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {scopeGroups.map((group) => (
                      <fieldset key={group.label} className="rounded-md border border-input/70 p-3">
                        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </legend>
                        <p className="mb-2 text-[11px] text-muted-foreground">{group.description}</p>
                        <ul className="space-y-1.5">
                          {group.scopes.map((scope) => (
                            <li key={scope}>
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  name="scopes"
                                  value={scope}
                                  className="h-3.5 w-3.5 rounded border-input bg-background text-primary"
                                />
                                <span className="font-mono">{scope}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </fieldset>
                    ))}
                  </div>
                </fieldset>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {tokenListErrorMessage ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Existing Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                    <p className="font-medium text-destructive">Token inventory unavailable</p>
                    <p className="mt-1 text-xs">{tokenListErrorMessage}</p>
                  </div>
                </CardContent>
              </Card>
            ) : apiTokens.length === 0 ? (
              <EmptyState
                title="No API tokens yet"
                description="Create one above to begin programmatic access."
              />
            ) : (
              apiTokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-accent/20"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {token.label ?? 'unlabeled token'}
                      </p>
                      <Badge variant={token.role === 'admin' ? 'warning' : 'info'}>
                        {token.role}
                      </Badge>
                      {token.revokedAt && <Badge variant="destructive">Revoked</Badge>}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {token.tokenPreview}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {token.revokedAt
                        ? `Revoked at ${token.revokedAt}`
                        : token.expiresAt
                          ? `Expires at ${token.expiresAt}`
                          : 'No expiration'}
                    </p>
                    {token.scopes.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {token.scopes.map((scope) => (
                          <Badge key={scope} variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {!token.revokedAt && (
                    <div className="flex items-center gap-2">
                      <form action={rotateApiTokenAction}>
                        <input type="hidden" name="tokenId" value={token.id} readOnly />
                        <ConfirmSubmitButton
                          label="Rotate"
                          confirmMessage="Rotate this API token now? The current token will stop working immediately."
                          variant="outline"
                          size="sm"
                          pendingLabel="Rotating..."
                        />
                      </form>
                      <form action={revokeApiTokenAction}>
                        <input type="hidden" name="tokenId" value={token.id} readOnly />
                        <ConfirmSubmitButton
                          label="Revoke"
                          confirmMessage="Revoke this API token? Any clients using it will lose access immediately."
                          variant="destructive"
                          size="sm"
                          pendingLabel="Revoking..."
                        />
                      </form>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <LiveDataUnavailableState
          title="Token management unavailable"
          description={liveDataErrorMessage}
          actionHref="/settings"
          actionLabel="Open Settings"
        />
      )}
    </PageLayout>
  );
}
