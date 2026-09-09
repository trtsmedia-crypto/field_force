import {
  Users, UserCheck, MapPin, ClipboardCheck, IndianRupee, Route,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { LoadingBlock, ErrorBlock } from '../components/ui/States';
import { api, num } from '../lib/api';
import { compactInr, inr } from '../lib/format';

const STATUS_COLORS: Record<string, string> = {
  present: '#19B47E',
  late: '#F2B441',
  absent: '#E5484D',
  on_leave: '#4C5CE5',
  half_day: '#8B93AC',
  holiday: '#8B93AC',
  anomaly: '#E5484D',
};

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  on_leave: 'On leave',
  half_day: 'Half day',
  holiday: 'Holiday',
  anomaly: 'Anomaly',
};

export function Dashboard() {
  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api('/dashboard/summary'),
  });
  const sales = useQuery({
    queryKey: ['sales-trend'],
    queryFn: () => api('/dashboard/sales-trend'),
  });
  const visits = useQuery({
    queryKey: ['visit-trend'],
    queryFn: () => api('/dashboard/visit-trend'),
  });
  const split = useQuery({
    queryKey: ['attendance-split'],
    queryFn: () => api('/dashboard/attendance-split'),
  });
  const top = useQuery({
    queryKey: ['top-performers'],
    queryFn: () => api('/dashboard/top-performers'),
  });

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  if (summary.isError) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle={today} />
        <ErrorBlock
          message={(summary.error as Error).message}
          onRetry={() => summary.refetch()}
        />
      </>
    );
  }

  const s = summary.data;

  const salesData = (sales.data ?? []).map((r: any) => ({
    day: r.day,
    sales: num(r.sales),
  }));
  const visitData = (visits.data ?? []).map((r: any) => ({
    day: r.day,
    completed: num(r.completed),
    missed: num(r.missed),
  }));
  const splitData = (split.data ?? []).map((r: any) => ({
    name: STATUS_LABELS[r.status] ?? r.status,
    value: num(r.value),
    color: STATUS_COLORS[r.status] ?? '#8B93AC',
  }));

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${today} · all teams`} />

      {summary.isLoading || !s ? (
        <LoadingBlock rows={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Total employees"
            value={String(num(s.total_employees))}
            icon={Users}
            note={`${num(s.active_employees)} active accounts`}
          />
          <StatCard
            label="Present today"
            value={`${num(s.present_today)} of ${num(s.total_employees)}`}
            icon={UserCheck}
            accent="ok"
            note={`${num(s.late_today)} late · ${num(s.absent_today)} absent · ${num(s.on_leave_today)} on leave`}
          />
          <StatCard
            label="Currently on duty"
            value={String(num(s.on_field))}
            icon={MapPin}
            accent="duty"
            note="Duty started, not yet ended"
          />
          <StatCard
            label="Visits completed"
            value={`${num(s.visits_completed)} of ${num(s.visits_today)}`}
            icon={ClipboardCheck}
            accent="indigo"
            note={`${num(s.visits_pending)} pending · ${num(s.visits_missed)} missed`}
          />
          <StatCard
            label="Sales today"
            value={compactInr(num(s.sales_today))}
            icon={IndianRupee}
            accent="ok"
            note={`${compactInr(num(s.sales_month))} this month`}
          />
          <StatCard
            label="Distance travelled"
            value={`${(num(s.distance_today) / 1000).toFixed(1)} km`}
            icon={Route}
            accent="warn"
            note={`${num(s.open_tasks)} tasks still open`}
          />
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Sales this week" subtitle="Booked order value per day" />
          {sales.isLoading ? (
            <div className="h-[260px] animate-pulse rounded-xl bg-canvas" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4C5CE5" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#4C5CE5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEFF5" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="#6C748F" />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : String(v))}
                  tickLine={false} axisLine={false} fontSize={12} stroke="#6C748F"
                />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Area
                  type="monotone" dataKey="sales" stroke="#4C5CE5"
                  strokeWidth={2.5} fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardHeader title="Attendance" subtitle="This month" />
          {splitData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">
              No attendance recorded yet this month.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={splitData} dataKey="value" nameKey="name"
                    innerRadius={54} outerRadius={80} paddingAngle={3}
                  >
                    {splitData.map((d: any) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {splitData.map((d: any) => (
                  <div key={d.name} className="flex items-center gap-2 text-[13px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted">{d.name}</span>
                    <span className="ml-auto font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Visit completion" subtitle="Completed against missed" />
          {visits.isLoading ? (
            <div className="h-[230px] animate-pulse rounded-xl bg-canvas" />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={visitData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEFF5" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="#6C748F" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#6C748F" allowDecimals={false} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" fill="#19B47E" radius={[6, 6, 0, 0]} />
                <Bar dataKey="missed" fill="#E5484D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardHeader title="Top performers" subtitle="By order value booked today" />
          {top.isLoading ? (
            <LoadingBlock rows={4} />
          ) : (
            <div className="space-y-3">
              {(top.data ?? []).map((e: any, i: number) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                >
                  <span className="w-4 text-sm font-bold text-muted">{i + 1}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-wash text-[11px] font-bold text-indigo-deep">
                    {e.full_name.split(' ').map((p: string) => p[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.full_name}</p>
                    <p className="text-xs text-muted">
                      {e.territory ?? 'No territory'} · {num(e.visits_done)}/{num(e.visits_planned)} visits
                    </p>
                  </div>
                  <Badge tone={num(e.sales_today) > 0 ? 'ok' : 'neutral'}>
                    {compactInr(num(e.sales_today))}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
