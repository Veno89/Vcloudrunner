'use client';

import { useState } from 'react';
import type { ProjectServiceDefinition } from '@vcloudrunner/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { FormSubmitButton } from '@/components/form-submit-button';
import { updateProjectServicesAction } from './actions';

interface ServiceEditorProps {
  projectId: string;
  services: ProjectServiceDefinition[];
}

interface EditableService extends ProjectServiceDefinition {
  id: string;
}

let nextId = 0;
function createId() {
  return `svc-${++nextId}`;
}

function toEditable(services: ProjectServiceDefinition[]): EditableService[] {
  return services.map((s) => ({ ...s, id: createId() }));
}

function toDefinitions(services: EditableService[]): ProjectServiceDefinition[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return services.map(({ id, ...rest }) => rest);
}

export function ServiceEditor({ projectId, services: initialServices }: ServiceEditorProps) {
  const [services, setServices] = useState<EditableService[]>(() => toEditable(initialServices));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const publicCount = services.filter((s) => s.exposure === 'public').length;
  const nameSet = new Set<string>();
  const duplicateNames = new Set<string>();
  for (const s of services) {
    if (nameSet.has(s.name)) duplicateNames.add(s.name);
    nameSet.add(s.name);
  }

  const hasPublicNonWeb = services.some((s) => s.exposure === 'public' && s.kind !== 'web');
  const hasInvalidNames = services.some((s) => !/^[a-z][a-z0-9-]*$/.test(s.name));
  const hasEmptyNames = services.some((s) => s.name.length === 0);

  const isValid =
    services.length >= 1 &&
    services.length <= 12 &&
    publicCount === 1 &&
    !hasPublicNonWeb &&
    duplicateNames.size === 0 &&
    !hasInvalidNames &&
    !hasEmptyNames;

  const hasChanged = JSON.stringify(toDefinitions(services)) !== JSON.stringify(initialServices);

  function addService() {
    const newService: EditableService = {
      id: createId(),
      name: '',
      kind: 'web',
      sourceRoot: '.',
      exposure: 'internal',
    };
    setServices([...services, newService]);
    setExpandedId(newService.id);
  }

  function removeService(id: string) {
    setServices(services.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function updateService(id: string, patch: Partial<ProjectServiceDefinition>) {
    setServices(services.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <div className="space-y-3">
      {services.map((service) => {
        const isExpanded = expandedId === service.id;
        const isDuplicate = duplicateNames.has(service.name);
        const isPublic = service.exposure === 'public';

        return (
          <div key={service.id} className="rounded-md border px-3 py-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex items-center gap-2 text-left flex-1 min-w-0"
                onClick={() => setExpandedId(isExpanded ? null : service.id)}
              >
                <span className="font-medium truncate">{service.name || '(unnamed)'}</span>
                <Badge variant={isPublic ? 'default' : 'secondary'} className="text-xs">
                  {service.exposure}
                </Badge>
                <Badge variant="outline" className="text-xs">{service.kind}</Badge>
              </button>
              {services.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeService(service.id)}
                >
                  Remove
                </Button>
              )}
            </div>

            {isExpanded && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={service.name}
                    onChange={(e) => updateService(service.id, { name: e.target.value.toLowerCase() })}
                    placeholder="e.g. api, frontend, worker"
                    className={isDuplicate || (service.name.length > 0 && !/^[a-z][a-z0-9-]*$/.test(service.name)) ? 'border-destructive' : ''}
                  />
                  {isDuplicate && <p className="text-xs text-destructive">Name must be unique</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Source Root</Label>
                  <Input
                    value={service.sourceRoot}
                    onChange={(e) => updateService(service.id, { sourceRoot: e.target.value })}
                    placeholder="."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kind</Label>
                  <Select
                    value={service.kind}
                    onChange={(e) => updateService(service.id, { kind: e.target.value as 'web' | 'worker' })}
                  >
                    <option value="web">Web</option>
                    <option value="worker">Worker</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Exposure</Label>
                  <Select
                    value={service.exposure}
                    onChange={(e) => updateService(service.id, { exposure: e.target.value as 'public' | 'internal' })}
                  >
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Container Port</Label>
                  <Input
                    type="number"
                    value={service.runtime?.containerPort ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      updateService(service.id, { runtime: { ...service.runtime, containerPort: val } });
                    }}
                    placeholder="Default"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Memory (MB)</Label>
                  <Input
                    type="number"
                    value={service.runtime?.memoryMb ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      updateService(service.id, { runtime: { ...service.runtime, memoryMb: val } });
                    }}
                    placeholder="Default"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Restart Policy</Label>
                  <Select
                    value={service.runtime?.restartPolicy ?? 'unless-stopped'}
                    onChange={(e) => {
                      const val = e.target.value as 'no' | 'always' | 'unless-stopped' | 'on-failure';
                      updateService(service.id, { runtime: { ...service.runtime, restartPolicy: val } });
                    }}
                  >
                    <option value="unless-stopped">Unless Stopped</option>
                    <option value="always">Always</option>
                    <option value="on-failure">On Failure</option>
                    <option value="no">No</option>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2 border-t pt-2">
                  <Label className="text-xs font-medium">Health Check (optional)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Command</Label>
                      <Input
                        value={service.runtime?.healthCheck?.command ?? ''}
                        onChange={(e) => {
                          const cmd = e.target.value;
                          if (cmd.length === 0) {
                            const { healthCheck: _, ...rest } = service.runtime ?? {};
                            updateService(service.id, { runtime: Object.keys(rest).length > 0 ? rest : undefined });
                          } else {
                            updateService(service.id, {
                              runtime: {
                                ...service.runtime,
                                healthCheck: {
                                  command: cmd,
                                  intervalSeconds: service.runtime?.healthCheck?.intervalSeconds ?? 30,
                                  timeoutSeconds: service.runtime?.healthCheck?.timeoutSeconds ?? 5,
                                  retries: service.runtime?.healthCheck?.retries ?? 3,
                                  startPeriodSeconds: service.runtime?.healthCheck?.startPeriodSeconds ?? 10,
                                }
                              }
                            });
                          }
                        }}
                        placeholder="curl -f http://localhost:3000/health || exit 1"
                      />
                    </div>
                    {service.runtime?.healthCheck?.command && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Interval (seconds)</Label>
                          <Input
                            type="number"
                            value={service.runtime.healthCheck.intervalSeconds}
                            onChange={(e) => updateService(service.id, {
                              runtime: {
                                ...service.runtime,
                                healthCheck: { ...service.runtime!.healthCheck!, intervalSeconds: Number(e.target.value) || 30 }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Timeout (seconds)</Label>
                          <Input
                            type="number"
                            value={service.runtime.healthCheck.timeoutSeconds}
                            onChange={(e) => updateService(service.id, {
                              runtime: {
                                ...service.runtime,
                                healthCheck: { ...service.runtime!.healthCheck!, timeoutSeconds: Number(e.target.value) || 5 }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Retries</Label>
                          <Input
                            type="number"
                            value={service.runtime.healthCheck.retries}
                            onChange={(e) => updateService(service.id, {
                              runtime: {
                                ...service.runtime,
                                healthCheck: { ...service.runtime!.healthCheck!, retries: Number(e.target.value) || 3 }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Start Period (seconds)</Label>
                          <Input
                            type="number"
                            value={service.runtime.healthCheck.startPeriodSeconds}
                            onChange={(e) => updateService(service.id, {
                              runtime: {
                                ...service.runtime,
                                healthCheck: { ...service.runtime!.healthCheck!, startPeriodSeconds: Number(e.target.value) || 10 }
                              }
                            })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {services.length < 12 && (
        <Button type="button" variant="outline" size="sm" onClick={addService}>
          Add Service
        </Button>
      )}

      {publicCount !== 1 && (
        <p className="text-xs text-destructive">
          Exactly one service must be public.
        </p>
      )}
      {hasPublicNonWeb && (
        <p className="text-xs text-destructive">
          Public services must use the web kind.
        </p>
      )}

      {hasChanged && (
        <form action={updateProjectServicesAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="services" value={JSON.stringify(toDefinitions(services))} />
          <FormSubmitButton
            idleText="Save Services"
            pendingText="Saving..."
            disabled={!isValid}
            size="sm"
          />
        </form>
      )}
    </div>
  );
}
