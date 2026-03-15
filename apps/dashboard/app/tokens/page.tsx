import { redirect } from 'next/navigation';

export default function TokensShortcutPage() {
  redirect('/settings/tokens');
}
