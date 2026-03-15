import { TokenManagementPage } from '@/components/token-management-page';

interface SettingsTokensPageProps {
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

export default async function SettingsTokensPage({ searchParams }: SettingsTokensPageProps) {
  return <TokenManagementPage searchParams={searchParams} />;
}
