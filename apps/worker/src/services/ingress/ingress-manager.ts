export interface IngressManager {
  upsertRoute(input: { host: string; upstreamPort: number; containerName?: string; internalPort?: number }): Promise<void>;
  deleteRoute(input: { host: string }): Promise<void>;
}
