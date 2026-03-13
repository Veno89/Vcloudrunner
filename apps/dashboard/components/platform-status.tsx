import { PlatformStatusStrip } from '@/components/platform-status-strip';
import { fetchQueueHealth, fetchWorkerHealth, demoUserId } from '@/lib/api';

export async function PlatformStatus() {
  if (!demoUserId) {
    return null;
  }

  let apiStatus: 'ok' | 'degraded' | 'unavailable' = 'degraded';
  let queueStatus: 'ok' | 'degraded' | 'unavailable' = 'unavailable';
  let workerStatus: 'ok' | 'stale' | 'unavailable' = 'unavailable';
  let queueCounts = { waiting: 0, active: 0, completed: 0, failed: 0 };
  let workerAgeMs: number | undefined;

  try {
    const [queueHealth, workerHealth] = await Promise.all([
      fetchQueueHealth(),
      fetchWorkerHealth(),
    ]);

    apiStatus =
      queueHealth.status === 'unavailable' && workerHealth.status === 'unavailable'
        ? 'degraded'
        : 'ok';
    queueStatus = queueHealth.status;
    workerStatus = workerHealth.status;
    workerAgeMs = workerHealth.ageMs;

    if (queueHealth.counts) {
      queueCounts = {
        waiting: queueHealth.counts.waiting,
        active: queueHealth.counts.active,
        completed: queueHealth.counts.completed,
        failed: queueHealth.counts.failed,
      };
    }
  } catch {
    // fallback to defaults
  }

  return (
    <PlatformStatusStrip
      apiStatus={apiStatus}
      queueStatus={queueStatus}
      workerStatus={workerStatus}
      queueCounts={queueCounts}
      workerAgeMs={workerAgeMs}
    />
  );
}
