import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import type { Tone } from '../components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States';
import { api } from '../lib/api';

interface LeaveRow {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  employee_name: string;
}

const tone: Record<LeaveRow['status'], Tone> = {
  pending: 'warn', approved: 'ok', rejected: 'bad', cancelled: 'neutral',
};

const filters = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function Leaves() {
  const [status, setStatus] = useState('pending');
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<LeaveRow[]>({
    queryKey: ['leaves', status],
    queryFn: () => api(`/leaves${status ? `?status=${status}` : ''}`),
  });

  const review = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api(`/leaves/${id}/review`, { method: 'PATCH', body: { status: next } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  });

  const rows = data ?? [];

  const columns: Column<LeaveRow>[] = [
    { key: 'employee', header: 'Employee', render: (l) => l.employee_name },
    { key: 'type', header: 'Type', render: (l) => l.leave_type },
    {
      key: 'dates', header: 'Dates',
      render: (l) => l.start_date === l.end_date
        ? fmt(l.start_date)
        : `${fmt(l.start_date)} – ${fmt(l.end_date)}`,
    },
    { key: 'reason', header: 'Reason', render: (l) => l.reason ?? '—' },
    {
      key: 'status', header: 'Status', align: 'right',
      render: (l) => (
        <div className="flex items-center justify-end gap-2">
          <Badge tone={tone[l.status]}>{l.status[0].toUpperCase() + l.status.slice(1)}</Badge>
          {l.status === 'pending' && (
            <div className="flex gap-1">
              <button
                onClick={() => review.mutate({ id: l.id, next: 'approved' })}
                className="rounded-lg bg-ok-wash px-2 py-1 text-[11px] font-semibold text-ok hover:opacity-80"
              >
                Approve
              </button>
              <button
                onClick={() => review.mutate({ id: l.id, next: 'rejected' })}
                className="rounded-lg bg-bad-wash px-2 py-1 text-[11px] font-semibold text-bad hover:opacity-80"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Leave requests"
        subtitle="Approving marks the days on-leave in the attendance register automatically"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              status === f.key ? 'bg-ink text-white' : 'border border-line bg-white text-muted hover:bg-canvas'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingBlock rows={4} />
      ) : isError ? (
        <ErrorBlock message={(error as Error).message} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="No leave requests here"
          message="Requests submitted from the mobile app will appear here for approval."
        />
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}
    </>
  );
}
