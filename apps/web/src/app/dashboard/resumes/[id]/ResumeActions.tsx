'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function ResumeActions({ resumeId, isActive }: { resumeId: string; isActive: boolean }) {
  const router = useRouter();
  const [parsing, setParsing] = useState(false);
  const [settingActive, setSettingActive] = useState(false);

  const onParse = async () => {
    setParsing(true);
    try {
      const res = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: resumeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Resume parsed');
        router.refresh();
      } else toast.error(data.error ?? 'Parse failed');
    } finally {
      setParsing(false);
    }
  };

  const onSetActive = async () => {
    if (isActive) return;
    setSettingActive(true);
    try {
      const res = await fetch(`/api/resumes/${resumeId}/active`, { method: 'PUT' });
      if (res.ok) {
        toast.success('Set as active resume');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Failed');
      }
    } finally {
      setSettingActive(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onParse}
        disabled={parsing}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {parsing ? 'Parsing…' : 'Parse with Gemini'}
      </button>
      {!isActive && (
        <button
          type="button"
          onClick={onSetActive}
          disabled={settingActive}
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {settingActive ? 'Setting…' : 'Set as active'}
        </button>
      )}
    </div>
  );
}
