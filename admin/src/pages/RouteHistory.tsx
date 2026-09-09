import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States';
import { api } from '../lib/api';
import { km } from '../lib/format';

interface EmployeeOption {
  id: string;
  full_name: string;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
  speed: number | null;
  battery: number | null;
  accuracy: number | null;
  recorded_at: string;
}

export function RouteHistory() {
  const [searchParams] = useSearchParams();
  const [employeeId, setEmployeeId] = useState(searchParams.get('employeeId') ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const employees = useQuery<EmployeeOption[]>({
    queryKey: ['employees-simple'],
    queryFn: () => api('/employees'),
  });

  const route = useQuery({
    queryKey: ['route-history', employeeId, date],
    queryFn: () => api(`/tracking/history/${employeeId}?date=${date}`),
    enabled: !!employeeId,
  });

  const points: RoutePoint[] = route.data?.points ?? [];
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const bounds = points.length
    ? {
        minLat: Math.min(...lats), maxLat: Math.max(...lats),
        minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
      }
    : null;

  const project = (p: RoutePoint) => {
    if (!bounds) return { x: 50, y: 50 };
    const latSpan = bounds.maxLat - bounds.minLat || 0.001;
    const lngSpan = bounds.maxLng - bounds.minLng || 0.001;
    return {
      x: 8 + ((p.longitude - bounds.minLng) / lngSpan) * 84,
      y: 88 - ((p.latitude - bounds.minLat) / latSpan) * 76,
    };
  };

  const pathD = points
    .map((p, i) => {
      const { x, y } = project(p);
      return `${i === 0 ? 'M' : 'L'} ${x * 8} ${y * 6}`;
    })
    .join(' ');

  return (
    <>
      <PageHeader
        title="Route history"
        subtitle="Pick an employee and a date to replay their recorded path"
        actions={
          <>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            >
              <option value="">Select employee</option>
              {(employees.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            />
          </>
        }
      />

      {!employeeId ? (
        <EmptyBlock
          title="Pick an employee"
          message="Choose someone from the dropdown above to see their route for the selected date."
        />
      ) : route.isLoading ? (
        <LoadingBlock rows={3} />
      ) : route.isError ? (
        <ErrorBlock message={(route.error as Error).message} onRetry={() => route.refetch()} />
      ) : points.length === 0 ? (
        <EmptyBlock
          title="No location points for this date"
          message="Either duty was not started on this date, or tracking was disabled for this employee."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Card className="h-[520px]" padded={false}>
            <svg viewBox="0 0 800 600" className="h-full w-full">
              <defs>
                <pattern id="rgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#EEF0F6" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="800" height="600" fill="url(#rgrid)" />
              {pathD && (
                <path d={pathD} fill="none" stroke="#4C5CE5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {points.map((p, i) => {
                const { x, y } = project(p);
                const isEnd = i === points.length - 1;
                const isStart = i === 0;
                return (
                  <circle
                    key={i}
                    cx={x * 8}
                    cy={y * 6}
                    r={isStart || isEnd ? 7 : 3}
                    fill={isStart ? '#19B47E' : isEnd ? '#FF7A2F' : '#4C5CE5'}
                    stroke="white"
                    strokeWidth={isStart || isEnd ? 2 : 0}
                  />
                );
              })}
            </svg>
          </Card>

          <div className="space-y-4">
            <Card>
              <p className="text-xs text-muted">Distance travelled</p>
              <p className="mt-1 text-2xl font-bold tracking-[-0.03em]">
                {km(route.data.distanceMeters)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted">First point</p>
              <p className="mt-1 text-sm font-semibold">
                {route.data.firstPointAt
                  ? new Date(route.data.firstPointAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Last point</p>
              <p className="mt-1 text-sm font-semibold">
                {route.data.lastPointAt
                  ? new Date(route.data.lastPointAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Points recorded</p>
              <p className="mt-1 text-sm font-semibold">{points.length}</p>
            </Card>
            <p className="px-1 text-[11px] leading-relaxed text-muted">
              Green marks the start, orange the most recent point. Positions are
              real; this is a schematic view, not a street map.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
