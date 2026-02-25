/**
 * Seed a demo user and data. Run with: npm run db:seed (from repo root or apps/web).
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function seed() {
  console.log('Seeding...');
  const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
  if (profiles?.length) {
    const id = profiles[0].id;
    await supabase.from('resumes').upsert({
      user_id: id,
      name: 'Demo Resume',
      content: { summary: 'Full-stack engineer with 5+ years experience.' },
      is_default: true,
    });
    await supabase.from('job_preferences').upsert(
      {
        user_id: id,
        keywords: ['TypeScript', 'React', 'Node.js'],
        locations: ['Remote'],
        remote_only: true,
        match_threshold: 70,
      },
      { onConflict: 'user_id' }
    );
    console.log('Demo data upserted for existing user', id);
  } else {
    console.log('No profiles found. Sign up a user first, then run seed again.');
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
