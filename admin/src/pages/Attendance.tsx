import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, UserX, Clock, CalendarOff, ScanFace } from 'lucide-react';
import { photoUrl } from '../components/ui/FacePanel';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import type { Tone } from '../components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States';
import { api, num } from '../lib/api';
import { km } from '../lib/format';

interface Row {
  employee_id: string;
  employee_code: string;
  full_name: string;
  territory: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
  total_break_seconds: number | null;
  distance_meters: number | null;
  working_seconds: number | null;
  visits_done: string;
  visits_planned: string;
  start_selfie: string | null;
  start_face_score: number | null;
  start_face_verified: boolean | null;
  end_selfie: string | null;
  end_face_score: number | null;
  end_face_verified: boolean | null;
  reference_photo: string | null;
}

const tone: Record<string, Tone> = {
  present: 'ok', late: 'warn', absent: 'bad',
  on_leave: 'indigo', half_day: 'neutral', holiday: 'neutral', anomaly: 'bad',
};

const clock = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

const hours = (seconds: number | null) => {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export function Attendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, isError, error, refetch } = useQuery<Row[]>({
    queryKey: ['attendance', date],
    queryFn: () => api(`/attendance?date=${date}`),
  });

  const rows = data ?? [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  const columns: Column<Row & { id: string }>[] = [
    {
      key: 'name', header: 'Employee',
      render: (r) => (
        <div>
          <p className="font-semibold">{r.full_name}</p>
          <p className="text-xs text-muted">
            {r.employee_code} · {r.territory ?? 'No territory'}
          </p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (r) => (
        <Badge tone={tone[r.status] ?? 'neutral'}>
          {r.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'start', header: 'Duty started',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <FaceThumb
            selfie={r.start_selfie}
            score={r.start_face_score}
            verified={r.start_face_verified}
          />
          <span>{clock(r.start_time)}</span>
        </div>
      ),
    },
    {
      key: 'end', header: 'Duty ended',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <FaceThumb
            selfie={r.end_selfie}
            score={r.end_face_score}
            verified={r.end_face_verified}
          />
          <span>
            {r.end_time ? clock(r.end_time)
              : r.start_time ? <span className="text-duty">Still on duty</span>
              : '—'}
          </span>
        </div>
      ),
    },
    { key: 'hours', header: 'Working', render: (r) => hours(r.working_seconds) },
    { key: 'break', header: 'Break', render: (r) => hours(r.total_break_seconds) },
    { key: 'distance', header: 'Distance', align: 'right', render: (r) => km(num(r.distance_meters)) },
    {
      key: 'visits', header: 'Visits', align: 'right',
      render: (r) => `${num(r.visits_done)}/${num(r.visits_planned)}`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={new Date(date).toLocaleDateString('en-IN', {
          weekday: 'long', day: 'numeric', month: 'long',
        })}
        actions={
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
          />
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present" value={String(count('present'))} icon={UserCheck} accent="ok" />
        <StatCard label="Late" value={String(count('late'))} icon={Clock} accent="warn" />
        <StatCard label="Absent" value={String(count('absent'))} icon={UserX} accent="bad" />
        <StatCard label="On leave" value={String(count('on_leave'))} icon={CalendarOff} accent="indigo" />
      </div>

      {isLoading ? (
        <LoadingBlock rows={5} />
      ) : isError ? (
        <ErrorBlock message={(error as Error).message} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="No employees to show"
          message="Add employees first — their daily register builds itself as they start and end duty."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows.map((r) => ({ ...r, id: r.employee_id }))}
        />
      )}
    </>
  );
}

function FaceThumb({
  selfie,
  score,
  verified,
}: {
  selfie: string | null;
  score: number | null;
  verified: boolean | null;
}) {
  const url = photoUrl(selfie);
  if (!url && score == null) {
    return (
      <span className="flex h-9 w-8 items-center justify-center rounded-lg bg-canvas text-muted">
        <ScanFace size={14} />
      </span>
    );
  }
  return (
    <span className="relative inline-block">
      {url ? (
        <img src={url} alt="Attendance selfie" className="h-9 w-8 rounded-lg object-cover" />
      ) : (
        <span className="flex h-9 w-8 items-center justify-center rounded-lg bg-canvas text-muted">
          <ScanFace size={14} />
        </span>
      )}
      {score != null && (
        <span
          className={`absolute -bottom-1 -right-1 rounded px-1 text-[9px] font-bold text-white ${
            verified ? 'bg-ok' : 'bg-bad'
          }`}
        >
          {Math.round(score * 100)}
        </span>
      )}
    </span>
  );
}
