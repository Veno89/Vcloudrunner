import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPrimaryProjectService } from '@vcloudrunner/shared-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionToast } from '@/components/action-toast';
import { FormSubmitButton } from '@/components/form-submit-button';
import { ProjectSubnav } from '@/components/project-subnav';
import { PageLayout } from '@/components/page-layout';
import {
  apiAuthToken,
  fetchDeploymentsForProject,
  fetchProjectInvitations,
  fetchProjectMembers,
  fetchProjectsForCurrentUser,
  resolveViewerContext,
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { describeDashboardLiveDataFailure } from '@/lib/helpers';
import { deleteProjectAction } from '@/app/projects/actions';
import { updateProjectGeneralAction } from './actions';
import { ServiceEditor } from './service-editor';

interface ProjectSettingsPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

export default async function ProjectSettingsPage({ params, searchParams }: ProjectSettingsPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          requestAuth={requestAuth}
          {...(viewerContextError ? { error: viewerContextError } : {})}
          redirectTo={`/projects/${params.id}/settings`}
        />
      </PageLayout>
    );
  }

  try {
    const projects = await fetchProjectsForCurrentUser();
    const project = projects.find((item) => item.id === params.id);

    if (!project) {
      notFound();
    }

    const [projectMembersResult, deploymentsResult] = await Promise.allSettled([
      fetchProjectMembers(project.id),
      fetchDeploymentsForProject(project.id)
    ]);

    const projectMembers = projectMembersResult.status === 'fulfilled' ? projectMembersResult.value : [];
    const deployments = deploymentsResult.status === 'fulfilled' ? deploymentsResult.value : [];
    const projectMembersReadErrorMessage =
      projectMembersResult.status === 'rejected'
        ? describeDashboardLiveDataFailure({
            error: projectMembersResult.reason,
            hasDemoUserId: Boolean(viewer.userId),
            hasApiAuthToken: Boolean(apiAuthToken)
          })
        : null;
    const deploymentsReadErrorMessage =
      deploymentsResult.status === 'rejected'
        ? describeDashboardLiveDataFailure({
            error: deploymentsResult.reason,
            hasDemoUserId: Boolean(viewer.userId),
            hasApiAuthToken: Boolean(apiAuthToken)
          })
        : null;

    const currentViewerMembership = projectMembers.find((member) => member.userId === viewer.userId) ?? null;
    const ownerMember = projectMembers.find((member) => member.isOwner) ?? null;
    const canManageMembers =
      Boolean(viewer.user)
      && (
        viewer.role === 'admin'
        || project.userId === viewer.userId
        || currentViewerMembership?.role === 'admin'
      );
    const canDeleteProject =
      Boolean(viewer.user)
      && (
        viewer.role === 'admin'
        || project.userId === viewer.userId
      );

    let projectInvitations = [] as Awaited<ReturnType<typeof fetchProjectInvitations>>;
    let projectInvitationsReadErrorMessage: string | null = null;

    if (viewer.user && canManageMembers) {
      try {
        projectInvitations = await fetchProjectInvitations(project.id);
      } catch (error) {
        projectInvitationsReadErrorMessage = describeDashboardLiveDataFailure({
          error,
          hasDemoUserId: Boolean(viewer.userId),
          hasApiAuthToken: Boolean(apiAuthToken)
        });
      }
    }

    const pendingProjectInvitations = projectInvitations.filter((invitation) => invitation.status === 'pending');
    const sortedDeployments = deployments
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const activeDeletionBlockedDeployments = sortedDeployments.filter((deployment) =>
      deployment.status === 'queued'
      || deployment.status === 'building'
      || deployment.status === 'running'
    );
    const activeDeletionBlockedDeploymentSummary = activeDeletionBlockedDeployments
      .map((deployment) => `${deployment.serviceName ?? 'app'} (${deployment.status})`)
      .join(', ');
    const partialOutageDetail = [
      projectMembersReadErrorMessage ? `Project membership visibility unavailable. ${projectMembersReadErrorMessage}` : null,
      projectInvitationsReadErrorMessage ? `Invitation visibility unavailable. ${projectInvitationsReadErrorMessage}` : null,
      deploymentsReadErrorMessage ? `Deletion guard visibility unavailable. ${deploymentsReadErrorMessage}` : null
    ]
      .filter((message): message is string => Boolean(message))
      .join(' ');
    const primaryService = getPrimaryProjectService(project.services);
    const publicServiceCount = project.services.filter((service) => service.exposure === 'public').length;

    return (
      <PageLayout>
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl lg:p-7">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Link href="/projects" className="hover:text-white">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${project.id}`} className="hover:text-white">{project.name}</Link>
            <span>/</span>
            <span className="text-slate-200">Settings</span>
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Administrative controls
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Project Settings</h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-400">
                Manage project identity, service topology, access, and ownership for
                {' '}
                <span className="font-medium text-slate-100">{project.name}</span>
                . Operational health stays on the overview page; administrative changes live here.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Identity</p>
                <p className="pt-2 text-lg font-semibold text-white">{project.slug}</p>
                <p className="pt-1 font-mono text-xs text-slate-300">{project.defaultBranch}</p>
                <p className="pt-2 text-xs leading-6 text-slate-500">
                  Slug is stable. Branch can be updated below.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Access</p>
                <p className="pt-2 text-lg font-semibold text-white">
                  {projectMembersReadErrorMessage ? 'Unavailable' : projectMembers.length}
                </p>
                <p className="pt-1 text-xs text-slate-300">
                  {projectMembersReadErrorMessage
                    ? 'Membership data needs a reload.'
                    : `${pendingProjectInvitations.length} pending invitation${pendingProjectInvitations.length === 1 ? '' : 's'}`}
                </p>
                <p className="pt-2 text-xs leading-6 text-slate-500">
                  {ownerMember ? `Owner: ${ownerMember.user.name}` : 'Owner visibility depends on membership data.'}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Topology</p>
                <p className="pt-2 text-lg font-semibold text-white">{project.services.length} services</p>
                <p className="pt-1 text-xs text-slate-300">
                  {publicServiceCount} public / {Math.max(project.services.length - publicServiceCount, 0)} internal
                </p>
                <p className="pt-2 text-xs leading-6 text-slate-500">
                  Primary service: {primaryService.name}
                </p>
              </div>
            </div>
          </div>
        </div>

        <ProjectSubnav projectId={project.id} />

        <ActionToast
          status={searchParams?.status}
          message={searchParams?.message ? decodeURIComponent(searchParams.message) : undefined}
          fallbackErrorMessage="Project settings action failed."
        />

        {partialOutageDetail ? (
          <DemoModeBanner title="Partial outage" detail={partialOutageDetail}>
            The settings page is still usable, but some admin visibility is temporarily degraded.
          </DemoModeBanner>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-base text-white">General</CardTitle>
              <p className="text-sm leading-7 text-slate-400">
                Adjust the project name, repository source, and tracked branch without touching the slug.
              </p>
            </CardHeader>
            <CardContent>
              <form action={updateProjectGeneralAction} className="space-y-4">
                <input type="hidden" name="projectId" value={project.id} />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="project-name" className="text-xs uppercase tracking-[0.18em] text-slate-300">Project Name</Label>
                    <Input
                      id="project-name"
                      name="name"
                      defaultValue={project.name}
                      minLength={3}
                      maxLength={64}
                      required
                      className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default-branch" className="text-xs uppercase tracking-[0.18em] text-slate-300">Default Branch</Label>
                    <Input
                      id="default-branch"
                      name="defaultBranch"
                      defaultValue={project.defaultBranch}
                      maxLength={255}
                      required
                      className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="git-repo-url" className="text-xs uppercase tracking-[0.18em] text-slate-300">Git Repository URL</Label>
                  <Input
                    id="git-repo-url"
                    name="gitRepositoryUrl"
                    type="url"
                    defaultValue={project.gitRepositoryUrl}
                    required
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100"
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs leading-6 text-slate-500">
                    Project slug
                    {' '}
                    <code className="font-mono text-slate-100">{project.slug}</code>
                    {' '}
                    stays fixed so domains and internal references remain stable.
                  </p>
                  <FormSubmitButton
                    idleText="Save Changes"
                    pendingText="Saving..."
                    size="sm"
                    className="bg-sky-300 text-slate-950 hover:bg-sky-200"
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-base text-white">Access & Ownership</CardTitle>
              <p className="text-sm leading-7 text-slate-400">
                Member management has its own workspace so project overview stays focused on runtime health.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {projectMembersReadErrorMessage ? (
                <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
                  <p className="font-medium text-destructive">Project members unavailable</p>
                  <p className="mt-2 text-xs leading-6">{projectMembersReadErrorMessage}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Members</p>
                    <p className="pt-2 text-2xl font-semibold text-white">{projectMembers.length}</p>
                    <p className="pt-1 text-xs text-slate-500">Active project access records</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pending Invites</p>
                    <p className="pt-2 text-2xl font-semibold text-white">
                      {projectInvitationsReadErrorMessage ? 'Unavailable' : pendingProjectInvitations.length}
                    </p>
                    <p className="pt-1 text-xs text-slate-500">Outstanding claims waiting for acceptance</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Owner</p>
                    <p className="pt-2 text-sm font-semibold text-white">{ownerMember?.user.name ?? 'Unavailable'}</p>
                    <p className="pt-1 text-xs text-slate-500">{ownerMember?.user.email ?? 'Reload membership data to inspect ownership.'}</p>
                  </div>
                </div>
              )}

              {viewer.user && !canManageMembers ? (
                <p className="text-sm leading-7 text-slate-400">
                  You can review ownership context here, but member changes currently require owner, platform-admin, or project-admin access.
                </p>
              ) : null}

              {viewer.user && canManageMembers && projectInvitationsReadErrorMessage ? (
                <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
                  <p className="font-medium text-destructive">Invitation visibility degraded</p>
                  <p className="mt-2 text-xs leading-6">{projectInvitationsReadErrorMessage}</p>
                </div>
              ) : null}

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm leading-7 text-slate-400">
                  Invite teammates, adjust roles, redeliver claims, and transfer ownership from the dedicated Members view.
                </p>
                <div className="pt-3">
                  <Button asChild variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
                    <Link href={`/projects/${project.id}/members`}>Open Members Workspace</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="text-base text-white">Services</CardTitle>
            <p className="text-sm leading-7 text-slate-400">
              Define the services that make up this project. Each service deploys independently, and exactly one service must remain public.
            </p>
          </CardHeader>
          <CardContent>
            <ServiceEditor projectId={project.id} services={project.services} />
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-destructive/30 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
          <CardHeader className="border-b border-destructive/20">
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            <p className="text-sm leading-7 text-slate-400">
              Destructive actions stay here so they do not compete with the operational information on the overview page.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
              <p className="font-medium text-destructive">Delete this project</p>
              <p className="mt-2 text-xs leading-6">
                This permanently removes the project record, deployment history, environment variables, domain claims, membership and invitation data, and managed database records tracked for this project. Managed Postgres resources are deprovisioned as part of deletion when possible.
              </p>
              <p className="mt-2 text-xs leading-6">
                Deletion stays blocked while any deployment is queued, building, or running so we do not orphan live runtime or routing state.
              </p>
            </div>

            {!viewer.user ? (
              <p className="text-sm leading-7 text-slate-400">
                Complete account setup before deleting projects from the dashboard.
              </p>
            ) : null}

            {viewer.user && !canDeleteProject ? (
              <p className="text-sm leading-7 text-slate-400">
                Only the current project owner or a platform admin can delete this project.
              </p>
            ) : null}

            {deploymentsReadErrorMessage ? (
              <p className="text-sm leading-7 text-slate-400">
                Current deployment activity could not be loaded here. The API will still refuse deletion if any service is queued, building, or running.
              </p>
            ) : null}

            {!deploymentsReadErrorMessage && activeDeletionBlockedDeployments.length > 0 ? (
              <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
                <p className="font-medium text-destructive">Deletion is currently blocked</p>
                <p className="mt-2 text-xs leading-6">
                  Stop or cancel these active deployments first: {activeDeletionBlockedDeploymentSummary}
                </p>
              </div>
            ) : null}

            {viewer.user && canDeleteProject ? (
              <form action={deleteProjectAction} className="space-y-4 rounded-[1.5rem] border border-destructive/30 p-4">
                <input type="hidden" name="projectId" value={project.id} readOnly />
                <input type="hidden" name="projectName" value={project.name} readOnly />
                <input type="hidden" name="returnPath" value={`/projects/${project.id}/settings`} readOnly />
                <div className="space-y-2">
                  <Label htmlFor="project-delete-confirmation" className="text-xs uppercase tracking-[0.18em] text-slate-300">
                    Type <span className="font-mono text-slate-100">{project.name}</span> to confirm deletion
                  </Label>
                  <Input
                    id="project-delete-confirmation"
                    name="confirmName"
                    placeholder={project.name}
                    autoComplete="off"
                    required
                    disabled={activeDeletionBlockedDeployments.length > 0}
                    className="h-11 rounded-2xl border-destructive/30 bg-slate-950/80 text-slate-100"
                  />
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs leading-6 text-slate-500">
                    This cannot be undone from the dashboard.
                  </p>
                  <FormSubmitButton
                    idleText="Delete Project"
                    pendingText="Deleting..."
                    variant="destructive"
                    disabled={activeDeletionBlockedDeployments.length > 0}
                  />
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </PageLayout>
    );
  } catch (error) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          title="Project data unavailable"
          requestAuth={requestAuth}
          error={error}
          redirectTo={`/projects/${params.id}/settings`}
        />
      </PageLayout>
    );
  }
}
