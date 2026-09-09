import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'indigo',
  note,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: 'indigo' | 'ok' | 'duty' | 'bad' | 'warn';
  note?: string;
}) {
  const accents = {
    indigo: 'bg-indigo-wash text-indigo-brand',
    ok: 'bg-ok-wash text-ok',
    duty: 'bg-duty-wash text-duty',
    bad: 'bg-bad-wash text-bad',
    warn: 'bg-warn-wash text-warn-ink',
  } as const;

  return (
    <div className="rounded-xl2 border border-line bg-white p-5">
      <div className="flex items-start justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        <span className={clsx('rounded-lg p-2', accents[accent])}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-3 text-[26px] font-bold leading-none tracking-[-0.03em]">
        {value}
      </p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}
