import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { PageHeader, Button } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { Tone } from '../components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock, Toast } from '../components/ui/States';
import { api } from '../lib/api';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_at: string | null;
  customer_name: string | null;
  employee_name: string;
}

const priorityTone: Record<TaskRow['priority'], Tone> = {
  urgent: 'bad', high: 'duty', medium: 'indigo', low: 'neutral',
};
const priorityBar: Record<TaskRow['priority'], string> = {
  urgent: 'bg-bad', high: 'bg-duty', medium: 'bg-warn', low: 'bg-slate-300',
};

export function Tasks() {
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<TaskRow[]>({
    queryKey: ['tasks'],
    queryFn: () => api('/tasks'),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/tasks/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const rows = data ?? [];
  const open = rows.filter((t) => t.status !== 'completed');

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={
          rows.length
            ? `${open.length} open · ${rows.length - open.length} completed`
            : undefined
        }
        actions={<Button icon={Plus} onClick={() => setDrawer(true)}>Add task</Button>}
      />

      {isLoading ? (
        <LoadingBlock rows={4} />
      ) : isError ? (
        <ErrorBlock message={(error as Error).message} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="No tasks assigned"
          message="Assign work to your field team and track it to completion here."
          action={<Button icon={Plus} onClick={() => setDrawer(true)}>Add task</Button>}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((t) => {
            const done = t.status === 'completed';
            return (
              <Card key={t.id}>
                <div className="flex items-start gap-3.5">
                  <span
                    className={`mt-1 h-10 w-1 shrink-0 rounded-full ${priorityBar[t.priority]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${done ? 'text-muted line-through' : ''}`}>
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-1 text-[13px] leading-relaxed text-muted">
                        {t.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone={priorityTone[t.priority]}>
                        {t.priority[0].toUpperCase() + t.priority.slice(1)}
                      </Badge>
                      <Badge tone={done ? 'ok' : 'neutral'}>
                        {done ? 'Completed' : t.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted">
                        {t.employee_name}
                        {t.customer_name ? ` · ${t.customer_name}` : ''}
                      </span>
                    </div>
                  </div>
                  {!done && (
                    <button
                      onClick={() => update.mutate({ id: t.id, status: 'completed' })}
                      disabled={update.isPending}
                      className="shrink-0 rounded-xl border border-line px-3.5 py-2 text-[13px] font-semibold hover:bg-canvas disabled:opacity-50"
                    >
                      Mark done
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {drawer && (
        <TaskDrawer
          onClose={() => setDrawer(false)}
          onCreated={() => {
            setDrawer(false);
            setToast('Task created.');
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}
      {toast && <Toast message={toast} />}
    </>
  );
}

function TaskDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '', description: '', employeeId: '', customerId: '',
    priority: 'medium', dueAt: '',
  });
  const [error, setError] = useState<string | null>(null);

  const employees = useQuery({ queryKey: ['employees-simple'], queryFn: () => api('/employees') });
  const customers = useQuery({ queryKey: ['customers-simple'], queryFn: () => api('/customers') });

  const create = useMutation({
    mutationFn: () =>
      api('/tasks', {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description || undefined,
          employeeId: form.employeeId,
          customerId: form.customerId || null,
          priority: form.priority,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
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
            <h2 className="text-lg font-bold tracking-[-0.02em]">Add task</h2>
            <p className="mt-1 text-sm text-muted">Assign work to a field employee.</p>
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
            <span className="mb-1.5 block text-[13px] font-semibold">Title</span>
            <input
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Collect outstanding payment"
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-indigo-brand"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Description (optional)</span>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              placeholder="Any detail the employee needs"
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-indigo-brand"
            />
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
            <span className="mb-1.5 block text-[13px] font-semibold">Related customer (optional)</span>
            <select
              value={form.customerId}
              onChange={set('customerId')}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            >
              <option value="">None</option>
              {(customers.data ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.business_name}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Priority</span>
              <select
                value={form.priority}
                onChange={set('priority')}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Due (optional)</span>
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={set('dueAt')}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
              />
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-line bg-white px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              setError(null);
              if (!form.title.trim()) return setError('Enter a title for the task.');
              if (!form.employeeId) return setError('Pick who this task is for.');
              create.mutate();
            }}
          >
            {create.isPending ? 'Creating…' : 'Create task'}
          </Button>
        </div>
      </div>
    </div>
  );
}
