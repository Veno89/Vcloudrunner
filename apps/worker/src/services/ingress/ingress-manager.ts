export interface IngressManager {
  upsertRoute(input: { host: string; upstreamPort: number }): Promise<void>;
  deleteRoute(input: { host: string }): Promise<void>;
}
