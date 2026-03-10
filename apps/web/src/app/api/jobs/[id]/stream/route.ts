import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase/admin';

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

  const db  = getAdminDb();
  const doc = await db.collection('auto_apply_jobs').doc(id).get();

  if (!doc.exists || doc.data()?.user_id !== userId) {
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
        const snap = await db.collection('auto_apply_jobs').doc(id).get();
        if (snap.exists) {
          const row = snap.data()!;
          send({ progress: row.progress, status: row.status, logs: row.logs });
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
