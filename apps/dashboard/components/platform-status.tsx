import { PlatformStatusStrip } from '@/components/platform-status-strip';
import { createFallbackHealth, loadPlatformHealth } from '@/lib/loaders';

export async function PlatformStatus() {
  const health = await loadPlatformHealth().catch(() => createFallbackHealth());

  return (
    <PlatformStatusStrip
      apiStatus={health.apiStatus}
      queueStatus={health.queueStatus}
      workerStatus={health.workerStatus}
      queueCounts={health.queueCounts}
      workerAgeMs={health.workerAgeMs}
    />
  );
}
