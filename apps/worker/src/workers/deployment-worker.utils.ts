export function isNonRetryableDeploymentError(message: string): boolean {
  const normalized = message.toLowerCase();

  const nonRetryablePatterns = [
    'repository not found',
    'authentication failed',
    'could not read username',
    'remote: permission denied',
    'dockerfile parse error',
    'failed to read dockerfile',
    'no such file or directory: dockerfile',
    'project access denied',
    'missing or invalid x-user-id header'
  ];

  return nonRetryablePatterns.some((pattern) => normalized.includes(pattern));
}

export function remainingAttempts(job: { attemptsMade: number; opts: { attempts?: number } }): number {
  const maxAttempts = job.opts.attempts ?? 1;
  const usedAttempts = job.attemptsMade + 1;
  return Math.max(0, maxAttempts - usedAttempts);
}
