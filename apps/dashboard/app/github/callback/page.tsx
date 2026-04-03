import { redirect } from 'next/navigation';
import { registerGitHubInstallation } from '@/lib/api';

interface GitHubCallbackPageProps {
  searchParams?: {
    installation_id?: string;
    setup_action?: string;
  };
}

export default async function GitHubCallbackPage({ searchParams }: GitHubCallbackPageProps) {
  const installationIdParam = searchParams?.installation_id;

  if (!installationIdParam) {
    redirect('/projects?status=error&reason=invalid_input');
  }

  const installationId = Number(installationIdParam);
  if (!Number.isInteger(installationId) || installationId <= 0) {
    redirect('/projects?status=error&reason=invalid_input');
  }

  try {
    await registerGitHubInstallation(installationId);
  } catch {
    redirect('/projects?status=error&reason=github_install_failed');
  }

  redirect('/projects?status=success&message=' + encodeURIComponent('GitHub account connected! You can now select repos when creating a project.'));
}
