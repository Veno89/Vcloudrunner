export interface GcsAccessTokenResolver {
  resolveAccessToken(): Promise<string>;
}
