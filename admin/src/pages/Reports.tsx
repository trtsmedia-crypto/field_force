import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { PageHeader, Button } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States';
import { api, num } from '../lib/api';
import { inr, km } from '../lib/format';

type ReportKind = 'attendance' | 'sales' | 'visits' | 'expenses';

const tabs: Array<{ key: ReportKind; label: string }> = [
  { key: 'attendance', label: 'Attendance' },
  { key: 'sales', label: 'Sales' },
  { key: 'visits', label: 'Visits' },
  { key: 'expenses', label: 'Expenses' },
];

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Reports() {
  const [kind, setKind] = useState<ReportKind>('attendance');
  const [from, setFrom] = useState(
    new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['report', kind, from, to],
    queryFn: () => api(`/dashboard/reports/${kind}?from=${from}&to=${to}`),
  });

  const rows = data ?? [];

  const columnSets: Record<ReportKind, Column<any>[]> = {
    attendance: [
      { key: 'name', header: 'Employee', render: (r) => `${r.full_name} (${r.employee_code})` },
      { key: 'territory', header: 'Territory', render: (r) => r.territory ?? '—' },
      { key: 'present', header: 'Present', align: 'right', render: (r) => num(r.present_days) },
      { key: 'late', header: 'Late', align: 'right', render: (r) => num(r.late_days) },
      { key: 'absent', header: 'Absent', align: 'right', render: (r) => num(r.absent_days) },
      { key: 'leave', header: 'Leave', align: 'right', render: (r) => num(r.leave_days) },
      { key: 'distance', header: 'Distance', align: 'right', render: (r) => km(num(r.total_distance)) },
      {
        key: 'hours', header: 'Working hours', align: 'right',
        render: (r) => `${Math.round(num(r.total_working_seconds) / 3600)}h`,
      },
    ],
    sales: [
      { key: 'name', header: 'Employee', render: (r) => `${r.full_name} (${r.employee_code})` },
      { key: 'territory', header: 'Territory', render: (r) => r.territory ?? '—' },
      { key: 'orders', header: 'Orders', align: 'right', render: (r) => num(r.order_count) },
      { key: 'total', header: 'Total booked', align: 'right', render: (r) => inr(num(r.total_sales)) },
      { key: 'approved', header: 'Approved', align: 'right', render: (r) => inr(num(r.approved_sales)) },
    ],
    visits: [
      { key: 'name', header: 'Employee', render: (r) => `${r.full_name} (${r.employee_code})` },
      { key: 'territory', header: 'Territory', render: (r) => r.territory ?? '—' },
      { key: 'total', header: 'Total visits', align: 'right', render: (r) => num(r.total_visits) },
      { key: 'completed', header: 'Completed', align: 'right', render: (r) => num(r.completed_visits) },
      { key: 'missed', header: 'Missed', align: 'right', render: (r) => num(r.missed_visits) },
      { key: 'avg', header: 'Avg duration', align: 'right', render: (r) => `${Math.round(num(r.avg_duration_minutes))} min` },
      { key: 'value', header: 'Order value', align: 'right', render: (r) => inr(num(r.total_order_value)) },
    ],
    expenses: [
      { key: 'name', header: 'Employee', render: (r) => `${r.full_name} (${r.employee_code})` },
      { key: 'count', header: 'Claims', align: 'right', render: (r) => num(r.expense_count) },
      { key: 'approved', header: 'Approved', align: 'right', render: (r) => inr(num(r.approved_amount)) },
      { key: 'pending', header: 'Pending', align: 'right', render: (r) => inr(num(r.pending_amount)) },
    ],
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${from} to ${to}`}
        actions={
          <>
            <input
              type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            />
            <input
              type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            />
            <Button
              variant="ghost"
              icon={Download}
              onClick={() => download(`${kind}-report-${from}-to-${to}.csv`, toCsv(rows))}
            >
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setKind(t.key)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              kind === t.key ? 'bg-ink text-white' : 'border border-line bg-white text-muted hover:bg-canvas'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingBlock rows={5} />
      ) : isError ? (
        <ErrorBlock message={(error as Error).message} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="No data for this range"
          message="Try a wider date range, or check back once your team has logged some activity."
        />
      ) : (
        <DataTable
          columns={columnSets[kind]}
          rows={rows.map((r: any, i: number) => ({ ...r, id: String(i) }))}
        />
      )}
    </>
  );
}
