import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: resumes } = await supabase
          .from('resumes')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        const hasResume = Array.isArray(resumes) && resumes.length > 0;
        const next = hasResume ? '/dashboard' : '/dashboard/resumes';
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
