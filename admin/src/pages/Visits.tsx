import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { PageHeader, Button } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import type { Tone } from '../components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock, Toast } from '../components/ui/States';
import { api, num } from '../lib/api';
import { inr } from '../lib/format';

interface VisitRow {
  id: string;
  visit_code: string;
  business_name: string;
  area: string | null;
  employee_name: string;
  purpose: string | null;
  status: 'scheduled' | 'started' | 'completed' | 'cancelled' | 'missed';
  scheduled_at: string | null;
  check_in_at: string | null;
  duration_minutes: number | null;
  order_amount: number;
  check_in_distance: number | null;
}

const tone: Record<VisitRow['status'], Tone> = {
  completed: 'ok', started: 'duty', scheduled: 'indigo',
  missed: 'bad', cancelled: 'neutral',
};
const label: Record<VisitRow['status'], string> = {
  completed: 'Completed', started: 'In progress', scheduled: 'Scheduled',
  missed: 'Missed', cancelled: 'Cancelled',
};

const filters = [
  { key: '', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'started', label: 'In progress' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'missed', label: 'Missed' },
];

const time = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

export function Visits() {
  const [status, setStatus] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<VisitRow[]>({
    queryKey: ['visits', status, date],
    queryFn: () =>
      api(`/visits?date=${date}${status ? `&status=${status}` : ''}`),
  });

  const columns: Column<VisitRow>[] = [
    {
      key: 'code', header: 'Visit',
      render: (v) => <span className="font-mono text-xs text-muted">{v.visit_code}</span>,
    },
    {
      key: 'customer', header: 'Customer',
      render: (v) => (
        <div>
          <p className="font-semibold">{v.business_name}</p>
          <p className="text-xs text-muted">{v.area ?? '—'}</p>
        </div>
      ),
    },
    { key: 'employee', header: 'Employee', render: (v) => v.employee_name },
    { key: 'purpose', header: 'Purpose', render: (v) => v.purpose ?? '—' },
    {
      key: 'time', header: 'Time',
      render: (v) => (
        <div>
          <p>{time(v.scheduled_at)}</p>
          {v.check_in_at && (
            <p className="text-xs text-muted">in at {time(v.check_in_at)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'duration', header: 'Duration', align: 'right',
      render: (v) => (v.duration_minutes ? `${v.duration_minutes} min` : '—'),
    },
    {
      key: 'order', header: 'Order', align: 'right',
      render: (v) =>
        num(v.order_amount) > 0 ? (
          <span className="font-semibold text-ok">{inr(num(v.order_amount))}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'status', header: 'Status', align: 'right',
      render: (v) => (
        <Badge tone={tone[v.status]} dot={v.status === 'started'}>
          {label[v.status]}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Visits"
        subtitle={data ? `${data.length} visits on this date` : undefined}
        actions={
          <>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            />
            <Button icon={Plus} onClick={() => setDrawer(true)}>Add visit</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              status === f.key
                ? 'bg-ink text-white'
                : 'border border-line bg-white text-muted hover:bg-canvas'
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
      ) : (data ?? []).length === 0 ? (
        <EmptyBlock
          title="No visits on this date"
          message="Visits appear here as they are planned, and update the moment an employee checks in from the field."
          action={<Button icon={Plus} onClick={() => setDrawer(true)}>Add visit</Button>}
        />
      ) : (
        <DataTable columns={columns} rows={data ?? []} />
      )}

      {drawer && (
        <VisitDrawer
          defaultDate={date}
          onClose={() => setDrawer(false)}
          onCreated={() => {
            setDrawer(false);
            setToast('Visit scheduled.');
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}
      {toast && <Toast message={toast} />}
    </>
  );
}

function VisitDrawer({
  defaultDate,
  onClose,
  onCreated,
}: {
  defaultDate: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    customerId: '', employeeId: '', purpose: '', scheduledAt: '',
  });
  const [error, setError] = useState<string | null>(null);

  const employees = useQuery({ queryKey: ['employees-simple'], queryFn: () => api('/employees') });
  const customers = useQuery({ queryKey: ['customers-simple'], queryFn: () => api('/customers') });

  const create = useMutation({
    mutationFn: () =>
      api('/visits', {
        method: 'POST',
        body: {
          customerId: form.customerId,
          employeeId: form.employeeId,
          purpose: form.purpose,
          scheduledAt: form.scheduledAt
            ? new Date(form.scheduledAt).toISOString()
            : `${defaultDate}T10:00:00`,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      onCreated();
    },
    onError: (err: Error) => setError(err.message),
  });

  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} role="presentation" />
      <div className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-bold tracking-[-0.02em]">Add visit</h2>
            <p className="mt-1 text-sm text-muted">
              Schedule a customer visit for a field employee.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-canvas">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-5 rounded-xl bg-bad-wash px-4 py-3 text-[13px] text-bad">
            {error}
          </div>
        )}

        <div className="space-y-5 px-6 py-6">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Customer</span>
            <select
              value={form.customerId}
              onChange={set('customerId')}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            >
              <option value="">Select customer</option>
              {(customers.data ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.business_name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Assign to</span>
            <select
              value={form.employeeId}
              onChange={set('employeeId')}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            >
              <option value="">Select employee</option>
              {(employees.data ?? []).map((e: any) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Purpose</span>
            <input
              value={form.purpose}
              onChange={set('purpose')}
              placeholder="e.g. Order collection"
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-indigo-brand"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Scheduled time (optional)</span>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={set('scheduledAt')}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            />
          </label>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-line bg-white px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              setError(null);
              if (!form.customerId) return setError('Pick a customer.');
              if (!form.employeeId) return setError('Pick an employee.');
              if (!form.purpose.trim()) return setError('Enter the purpose of the visit.');
              create.mutate();
            }}
          >
            {create.isPending ? 'Scheduling…' : 'Schedule visit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
