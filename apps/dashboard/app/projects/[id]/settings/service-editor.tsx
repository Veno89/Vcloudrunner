'use client';

import { useState } from 'react';
import type { ProjectServiceDefinition } from '@vcloudrunner/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { FormSubmitButton } from '@/components/form-submit-button';
import { HelpTip } from '@/components/help-tip';
import { TIPS } from '@/lib/onboarding/steps';
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
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Services</p>
          <p className="pt-2 text-2xl font-semibold text-white">{services.length}</p>
          <p className="pt-1 text-xs text-slate-500">Deployable units in this project</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Public services</p>
          <p className="pt-2 text-2xl font-semibold text-white">{publicCount}</p>
          <p className="pt-1 text-xs text-slate-500">Exactly one public web service is required</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Validation</p>
          <p className="pt-2 text-2xl font-semibold text-white">{isValid ? 'Ready' : 'Needs care'}</p>
          <p className="pt-1 text-xs text-slate-500">We check naming, exposure, and topology rules before save</p>
        </div>
      </div>

      {services.map((service) => {
        const isExpanded = expandedId === service.id;
        const isDuplicate = duplicateNames.has(service.name);
        const isPublic = service.exposure === 'public';

        return (
          <div key={service.id} className="space-y-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_18px_48px_rgba(2,6,23,0.18)]">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => setExpandedId(isExpanded ? null : service.id)}
              >
                <span className="truncate font-medium text-slate-100">{service.name || '(unnamed)'}</span>
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
              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Name</Label>
                  <Input
                    value={service.name}
                    onChange={(e) => updateService(service.id, { name: e.target.value.toLowerCase() })}
                    placeholder="e.g. api, frontend, worker"
                    className={`h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100 ${isDuplicate || (service.name.length > 0 && !/^[a-z][a-z0-9-]*$/.test(service.name)) ? 'border-destructive' : ''}`}
                  />
                  {isDuplicate && <p className="text-xs text-destructive">Name must be unique</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Source Root</Label>
                  <Input
                    value={service.sourceRoot}
                    onChange={(e) => updateService(service.id, { sourceRoot: e.target.value })}
                    placeholder="."
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Kind</Label>
                    <HelpTip label={TIPS.SERVICE_KIND.label} side="top" />
                  </div>
                  <Select
                    value={service.kind}
                    onChange={(e) => updateService(service.id, { kind: e.target.value as 'web' | 'worker' })}
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                  >
                    <option value="web">Web</option>
                    <option value="worker">Worker</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Exposure</Label>
                    <HelpTip label={TIPS.SERVICE_EXPOSURE.label} side="top" />
                  </div>
                  <Select
                    value={service.exposure}
                    onChange={(e) => updateService(service.id, { exposure: e.target.value as 'public' | 'internal' })}
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                  >
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Container Port</Label>
                    <HelpTip label={TIPS.CONTAINER_PORT.label} side="top" />
                  </div>
                  <Input
                    type="number"
                    value={service.runtime?.containerPort ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      updateService(service.id, { runtime: { ...service.runtime, containerPort: val } });
                    }}
                    placeholder="Default"
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Memory (MB)</Label>
                    <HelpTip label={TIPS.MEMORY_MB.label} side="top" />
                  </div>
                  <Input
                    type="number"
                    value={service.runtime?.memoryMb ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      updateService(service.id, { runtime: { ...service.runtime, memoryMb: val } });
                    }}
                    placeholder="Default"
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Restart Policy</Label>
                    <HelpTip label={TIPS.RESTART_POLICY.label} side="top" />
                  </div>
                  <Select
                    value={service.runtime?.restartPolicy ?? 'unless-stopped'}
                    onChange={(e) => {
                      const val = e.target.value as 'no' | 'always' | 'unless-stopped' | 'on-failure';
                      updateService(service.id, { runtime: { ...service.runtime, restartPolicy: val } });
                    }}
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                  >
                    <option value="unless-stopped">Unless Stopped</option>
                    <option value="always">Always</option>
                    <option value="on-failure">On Failure</option>
                    <option value="no">No</option>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2 border-t border-white/10 pt-3">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300">Health Check (optional)</Label>
                    <HelpTip label={TIPS.HEALTH_CHECK_COMMAND.label} side="top" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Command</Label>
                      <Input
                        value={service.runtime?.healthCheck?.command ?? ''}
                        onChange={(e) => {
                          const cmd = e.target.value;
                          if (cmd.length === 0) {
                            const runtime = service.runtime ?? {};
                            const { healthCheck, ...rest } = runtime;
                            void healthCheck;
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
                        className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                      />
                    </div>
                    {service.runtime?.healthCheck?.command && (
                      <>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Interval (seconds)</Label>
                            <HelpTip label={TIPS.HEALTH_CHECK_INTERVAL.label} side="top" />
                          </div>
                          <Input
                            type="number"
                            value={service.runtime.healthCheck.intervalSeconds}
                            onChange={(e) => updateService(service.id, {
                              runtime: {
                                ...service.runtime,
                                healthCheck: { ...service.runtime!.healthCheck!, intervalSeconds: Number(e.target.value) || 30 }
                              }
                            })}
                            className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Timeout (seconds)</Label>
                            <HelpTip label={TIPS.HEALTH_CHECK_TIMEOUT.label} side="top" />
                          </div>
                          <Input
                            type="number"
                            value={service.runtime.healthCheck.timeoutSeconds}
                            onChange={(e) => updateService(service.id, {
                              runtime: {
                                ...service.runtime,
                                healthCheck: { ...service.runtime!.healthCheck!, timeoutSeconds: Number(e.target.value) || 5 }
                              }
                            })}
                            className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Retries</Label>
                            <HelpTip label={TIPS.HEALTH_CHECK_RETRIES.label} side="top" />
                          </div>
                          <Input
                            type="number"
                            value={service.runtime.healthCheck.retries}
                            onChange={(e) => updateService(service.id, {
                              runtime: {
                                ...service.runtime,
                                healthCheck: { ...service.runtime!.healthCheck!, retries: Number(e.target.value) || 3 }
                              }
                            })}
                            className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs uppercase tracking-[0.18em] text-slate-300">Start Period (seconds)</Label>
                            <HelpTip label={TIPS.HEALTH_CHECK_START_PERIOD.label} side="top" />
                          </div>
                          <Input
                            type="number"
                            value={service.runtime.healthCheck.startPeriodSeconds}
                            onChange={(e) => updateService(service.id, {
                              runtime: {
                                ...service.runtime,
                                healthCheck: { ...service.runtime!.healthCheck!, startPeriodSeconds: Number(e.target.value) || 10 }
                              }
                            })}
                            className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
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
        <Button type="button" variant="outline" size="sm" onClick={addService} className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
          Add Service
        </Button>
      )}

      {publicCount !== 1 || hasPublicNonWeb ? (
        <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/5 p-4 text-xs leading-6 text-foreground">
          {publicCount !== 1 ? (
            <p className="text-destructive">Exactly one service must be public.</p>
          ) : null}
          {hasPublicNonWeb ? (
            <p className="text-destructive">Public services must use the web kind.</p>
          ) : null}
        </div>
      ) : null}

      {hasChanged && (
        <form action={updateProjectServicesAction} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="services" value={JSON.stringify(toDefinitions(services))} />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs leading-6 text-slate-500">
              Save the service topology after the validation state reads ready.
            </p>
            <FormSubmitButton
              idleText="Save Services"
              pendingText="Saving..."
              disabled={!isValid}
              size="sm"
              className="bg-sky-300 text-slate-950 hover:bg-sky-200"
            />
          </div>
        </form>
      )}
    </div>
  );
}
