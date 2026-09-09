import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import type { Tone } from '../components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States';
import { api } from '../lib/api';
import { inr } from '../lib/format';

interface ExpenseRow {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  employee_name: string;
  receipt_url: string | null;
}

const tone: Record<ExpenseRow['status'], Tone> = {
  pending: 'warn', approved: 'ok', rejected: 'bad',
};

const filters = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export function Expenses() {
  const [status, setStatus] = useState('pending');
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', status],
    queryFn: () => api(`/expenses${status ? `?status=${status}` : ''}`),
  });

  const review = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api(`/expenses/${id}/review`, { method: 'PATCH', body: { status: next } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const rows = data ?? [];
  const totalPending = rows
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + Number(r.amount), 0);

  const columns: Column<ExpenseRow>[] = [
    { key: 'employee', header: 'Employee', render: (x) => x.employee_name },
    { key: 'category', header: 'Category', render: (x) => x.category[0].toUpperCase() + x.category.slice(1) },
    { key: 'description', header: 'Description', render: (x) => x.description ?? '—' },
    {
      key: 'date', header: 'Date',
      render: (x) => new Date(x.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    },
    {
      key: 'amount', header: 'Amount', align: 'right',
      render: (x) => <span className="font-semibold">{inr(Number(x.amount))}</span>,
    },
    {
      key: 'status', header: 'Status', align: 'right',
      render: (x) => (
        <div className="flex items-center justify-end gap-2">
          <Badge tone={tone[x.status]}>{x.status[0].toUpperCase() + x.status.slice(1)}</Badge>
          {x.status === 'pending' && (
            <div className="flex gap-1">
              <button
                onClick={() => review.mutate({ id: x.id, next: 'approved' })}
                className="rounded-lg bg-ok-wash px-2 py-1 text-[11px] font-semibold text-ok hover:opacity-80"
              >
                Approve
              </button>
              <button
                onClick={() => review.mutate({ id: x.id, next: 'rejected' })}
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
        title="Expenses"
        subtitle={totalPending > 0 ? `${inr(totalPending)} awaiting approval` : undefined}
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
          title="No expense claims here"
          message="Claims submitted by your field team from the mobile app will appear here for approval."
        />
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}
    </>
  );
}
