import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

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
      if (token.sub) {
        (session as { userId?: string }).userId = token.sub;
      }
      return session;
    },
    async jwt({ token, profile }) {
      // Only runs on first sign-in (when profile is present)
      if (profile && token.sub) {
        try {
          const db = getAdminDb();
          const userId = token.sub;
          const email = (profile as { email?: string }).email ?? null;
          const fullName = (profile as { name?: string }).name ?? null;
          const avatarUrl = (profile as { picture?: string }).picture ?? null;
          const now = new Date().toISOString();

          await db.collection('profiles').doc(userId).set(
            { email, full_name: fullName, avatar_url: avatarUrl, updated_at: now },
            { merge: true }
          );

          // Set created_at only on first create
          await db.collection('profiles').doc(userId).set(
            { created_at: FieldValue.serverTimestamp() },
            { merge: true }
          );

          const counterDoc = await db.collection('usage_counters').doc(userId).get();
          if (!counterDoc.exists) {
            await db.collection('usage_counters').doc(userId).set({
              user_id: userId,
              applications_today: 0,
              plan_type: 'free_plan',
              last_reset_date: now,
              created_at: FieldValue.serverTimestamp(),
              updated_at: FieldValue.serverTimestamp(),
            });
          }
        } catch (err) {
          console.error('Firebase profile upsert error:', err);
          throw new Error('Cannot reach database. Check your connection or try again later.');
        }
      }
      return token;
    },
  },
  pages: { signIn: '/login' },
};
