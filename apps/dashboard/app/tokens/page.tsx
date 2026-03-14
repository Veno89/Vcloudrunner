import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { ActionToast } from '@/components/action-toast';
import { FormSubmitButton } from '@/components/form-submit-button';
import { fetchApiTokensForUser, demoUserId } from '@/lib/api';
import { createApiTokenAction, revokeApiTokenAction, rotateApiTokenAction } from './actions';

interface TokensPageProps {
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

export default async function TokensPage({ searchParams }: TokensPageProps) {
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

  if (demoUserId) {
    try {
      const fetched = await fetchApiTokensForUser(demoUserId);
      apiTokens = fetched.map((token) => ({
        id: token.id,
        label: token.label,
        role: token.role,
        scopes: token.scopes,
        tokenPreview: token.tokenPreview,
        revokedAt: token.revokedAt,
        expiresAt: token.expiresAt,
      }));
    } catch {
      // will show empty state
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Tokens</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage API tokens for programmatic access.
        </p>
      </div>

      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Token operation failed."
      />

      {tokenPlaintextFromCookie && (
        <div className="rounded-md border border-amber-700/80 bg-amber-950/40 p-4">
          <p className="text-sm font-medium text-amber-200">
            Copy this token now. It will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-background px-3 py-2 font-mono text-xs text-amber-100">
            {tokenPlaintextFromCookie}
          </code>
        </div>
      )}

      {demoUserId ? (
        <>
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
                  <select
                    id="token-role"
                    name="role"
                    defaultValue="user"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
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
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {[
                      'projects:read', 'projects:write',
                      'deployments:read', 'deployments:write', 'deployments:cancel',
                      'environment:read', 'environment:write',
                      'logs:read',
                      'tokens:read', 'tokens:write',
                    ].map((scope) => (
                      <label key={scope} className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" name="scopes" value={scope} className="rounded border-input" />
                        <span className="font-mono">{scope}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {apiTokens.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No API tokens yet. Create one above.
                </CardContent>
              </Card>
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
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Token management requires a demo user context. Set NEXT_PUBLIC_DEMO_USER_ID.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
