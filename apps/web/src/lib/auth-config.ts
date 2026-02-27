import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createAdminClient } from '@/lib/supabase/admin';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn() {
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as { supabaseUserId?: string }).supabaseUserId = token.sub as string;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      if (account && profile && typeof profile.email === 'string') {
        try {
          const supabase = createAdminClient();
          const email = profile.email as string;
          const fullName = (profile as { name?: string }).name ?? null;
          const avatarUrl = (profile as { picture?: string }).picture ?? null;

          const { data: created } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { full_name: fullName, avatar_url: avatarUrl },
          });
          let userId: string;
          if (created?.user?.id) {
            userId = created.user.id;
          } else {
            const { data: prof } = await supabase.from('profiles').select('id').eq('email', email).single();
            if (!prof?.id) return token;
            userId = prof.id;
          }

          await supabase.from('profiles').upsert(
            { id: userId, email, full_name: fullName, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
            { onConflict: 'id' }
          );
          const { data: uc } = await supabase.from('usage_counters').select('user_id').eq('user_id', userId).single();
          if (!uc) {
            await supabase.from('usage_counters').insert({ user_id: userId, plan_type: 'free_plan' });
          }
          token.sub = userId;
        } catch {
          throw new Error('Cannot reach database. Check your connection or try again later.');
        }
      }
      return token;
    },
  },
  pages: { signIn: '/login' },
};
