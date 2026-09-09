import clsx from 'clsx';
import type { ReactNode } from 'react';

export type Tone = 'ok' | 'warn' | 'bad' | 'indigo' | 'duty' | 'neutral';

const tones: Record<Tone, string> = {
  ok: 'bg-ok-wash text-ok',
  warn: 'bg-warn-wash text-warn-ink',
  bad: 'bg-bad-wash text-bad',
  indigo: 'bg-indigo-wash text-indigo-deep',
  duty: 'bg-duty-wash text-duty',
  neutral: 'bg-slate-100 text-muted',
};

const dots: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  indigo: 'bg-indigo-brand',
  duty: 'bg-duty',
  neutral: 'bg-muted',
};

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        tones[tone],
      )}
    >
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  );
}
