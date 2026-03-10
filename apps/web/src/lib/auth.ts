import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session as { userId?: string } | null)?.userId ?? null;
}
