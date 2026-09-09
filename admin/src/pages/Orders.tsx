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

interface OrderRow {
  id: string;
  order_code: string;
  order_date: string;
  business_name: string;
  employee_name: string;
  total: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
  items: Array<{ productName: string; quantity: number; unitPrice: number; lineTotal: number }>;
}

const tone: Record<OrderRow['status'], Tone> = {
  draft: 'neutral', submitted: 'indigo', approved: 'ok',
  rejected: 'bad', processing: 'warn', completed: 'ok', cancelled: 'neutral',
};

const filters = [
  { key: '', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'completed', label: 'Completed' },
];

export function Orders() {
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<OrderRow[]>({
    queryKey: ['orders', status],
    queryFn: () => api(`/orders${status ? `?status=${status}` : ''}`),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api(`/orders/${id}/status`, { method: 'PATCH', body: { status: next } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });

  const rows = data ?? [];
  const totalValue = rows.reduce((s, o) => s + Number(o.total), 0);

  const columns: Column<OrderRow>[] = [
    { key: 'code', header: 'Order', render: (o) => <span className="font-mono text-xs text-muted">{o.order_code}</span> },
    {
      key: 'customer', header: 'Customer',
      render: (o) => (
        <div>
          <p className="font-semibold">{o.business_name}</p>
          <p className="text-xs text-muted">
            {o.items.length} item{o.items.length !== 1 ? 's' : ''}
          </p>
        </div>
      ),
    },
    { key: 'employee', header: 'Booked by', render: (o) => o.employee_name },
    {
      key: 'date', header: 'Date',
      render: (o) => new Date(o.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    },
    {
      key: 'total', header: 'Total', align: 'right',
      render: (o) => <span className="font-semibold">{inr(Number(o.total))}</span>,
    },
    {
      key: 'status', header: 'Status', align: 'right',
      render: (o) => (
        <div className="flex items-center justify-end gap-2">
          <Badge tone={tone[o.status]}>{o.status[0].toUpperCase() + o.status.slice(1)}</Badge>
          {o.status === 'submitted' && (
            <div className="flex gap-1">
              <button
                onClick={() => updateStatus.mutate({ id: o.id, next: 'approved' })}
                className="rounded-lg bg-ok-wash px-2 py-1 text-[11px] font-semibold text-ok hover:opacity-80"
              >
                Approve
              </button>
              <button
                onClick={() => updateStatus.mutate({ id: o.id, next: 'rejected' })}
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
        title="Orders"
        subtitle={rows.length ? `${rows.length} orders · ${inr(totalValue)} total` : undefined}
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
        <LoadingBlock rows={5} />
      ) : isError ? (
        <ErrorBlock message={(error as Error).message} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="No orders yet"
          message="Orders booked by your field team from customer visits will appear here for approval."
        />
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}
    </>
  );
}
