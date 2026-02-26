import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from('auto_apply_jobs')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: { progress?: number; status?: string; logs?: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const interval = setInterval(async () => {
        if (request.signal?.aborted) {
          clearInterval(interval);
          controller.close();
          return;
        }
        const { data: row } = await supabase
          .from('auto_apply_jobs')
          .select('progress, status, logs')
          .eq('id', id)
          .single();
        if (row) {
          send(row);
          if (row.status === 'completed' || row.status === 'failed' || row.status === 'cancelled') {
            clearInterval(interval);
            controller.close();
          }
        }
      }, 2000);

      request.signal?.addEventListener?.('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache',
      Connection: 'keep-alive',
    },
  });
}
