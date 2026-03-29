export interface RuntimeNetworkSummary {
  name?: string;
}

export interface RuntimeContainerSummary {
  id: string;
  state: string;
}

export interface StartContainerInput {
  name: string;
  imageTag: string;
  env: Record<string, string>;
  networkName: string;
  networkAliases?: string[];
  additionalNetworkNames?: string[];
  containerPort: number;
  publishPort: boolean;
  memoryMb: number;
  cpuMillicores: number;
}

export interface StartedContainerResult {
  containerId: string;
  hostPort: number | null;
}

export interface ContainerRuntimeManager {
  listNetworksByName(name: string): Promise<RuntimeNetworkSummary[]>;
  createNetwork(name: string): Promise<void>;
  listContainersByName(name: string): Promise<RuntimeContainerSummary[]>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
  startContainer(input: StartContainerInput): Promise<StartedContainerResult>;
}
