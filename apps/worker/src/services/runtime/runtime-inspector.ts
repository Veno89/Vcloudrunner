export interface RuntimeInspector {
  isContainerRunning(containerId: string): Promise<boolean>;
}
