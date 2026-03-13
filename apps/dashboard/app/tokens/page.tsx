import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { fetchApiTokensForUser, demoUserId } from '@/lib/api';
import { truncateUuid } from '@/lib/helpers';
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

      {searchParams?.status === 'success' && searchParams.message && (
        <div className="rounded-md border border-emerald-700/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          {decodeURIComponent(searchParams.message)}
        </div>
      )}
      {searchParams?.status === 'error' && (
        <div className="rounded-md border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {searchParams.message ? decodeURIComponent(searchParams.message) : 'Operation failed'}
        </div>
      )}

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
                className="grid gap-2 md:grid-cols-[1fr_140px_180px_auto]"
              >
                <input
                  type="text"
                  name="label"
                  placeholder="Label (optional)"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <select
                  name="role"
                  defaultValue="user"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <input
                  type="datetime-local"
                  name="expiresAt"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Create Token
                </button>
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
                  className="flex items-center justify-between rounded-md border px-4 py-3"
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
                  </div>
                  {!token.revokedAt && (
                    <div className="flex items-center gap-2">
                      <form action={rotateApiTokenAction}>
                        <input type="hidden" name="tokenId" value={token.id} readOnly />
                        <ConfirmSubmitButton
                          label="Rotate"
                          confirmMessage="Rotate this API token now? The current token will stop working immediately."
                          className="rounded-md border border-amber-700 px-2.5 py-1 text-xs text-amber-300 hover:bg-amber-900/30 transition-colors"
                        />
                      </form>
                      <form action={revokeApiTokenAction}>
                        <input type="hidden" name="tokenId" value={token.id} readOnly />
                        <ConfirmSubmitButton
                          label="Revoke"
                          confirmMessage="Revoke this API token? Any clients using it will lose access immediately."
                          className="rounded-md border border-destructive px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
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
