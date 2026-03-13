export function remainingAttempts(job: { attemptsMade: number; opts: { attempts?: number } }): number {
  const maxAttempts = job.opts.attempts ?? 1;
  const usedAttempts = job.attemptsMade + 1;
  return Math.max(0, maxAttempts - usedAttempts);
}
