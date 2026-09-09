import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Battery, Gauge, Clock, X, Phone, Navigation } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader, Button } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import type { Tone } from '../components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States';
import { api, num } from '../lib/api';
import { km, compactInr } from '../lib/format';
import { GoogleMapView, hasMapsKey } from '../components/ui/GoogleMap';

interface LiveRow {
  id: string;
  employee_code: string;
  full_name: string;
  territory: string | null;
  team: string | null;
  latitude: number | null;
  longitude: number | null;
  battery: number | null;
  speed: number | null;
  last_seen: string | null;
  start_time: string | null;
  end_time: string | null;
  attendance_status: string;
  current_customer: string | null;
  distance_meters: number | null;
  visits_done: string;
  visits_planned: string;
  sales_today: number;
  tracking_enabled: boolean;
}

type Status = 'on-visit' | 'travelling' | 'idle' | 'online' | 'offline';

const meta: Record<Status, { label: string; tone: Tone; pin: string }> = {
  online: { label: 'Online', tone: 'ok', pin: '#19B47E' },
  'on-visit': { label: 'On visit', tone: 'indigo', pin: '#4C5CE5' },
  travelling: { label: 'Travelling', tone: 'duty', pin: '#FF7A2F' },
  idle: { label: 'Idle', tone: 'warn', pin: '#F2B441' },
  offline: { label: 'Offline', tone: 'neutral', pin: '#8B93AC' },
};

/** Status is derived from duty state, last ping and speed. */
function statusOf(r: LiveRow): Status {
  if (!r.start_time || r.end_time) return 'offline';
  if (!r.last_seen) return 'offline';
  const minutesAgo = (Date.now() - new Date(r.last_seen).getTime()) / 60000;
  if (minutesAgo > 20) return 'offline';
  if (r.current_customer) return 'on-visit';
  if (num(r.speed) > 5) return 'travelling';
  if (minutesAgo > 10) return 'idle';
  return 'online';
}

function sinceLabel(iso: string | null) {
  if (!iso) return 'no signal';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} hr ago`;
}

export function LiveTracking() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);

  // The map keeps itself current; no refresh button needed.
  const { data, isLoading, isError, error, refetch } = useQuery<LiveRow[]>({
    queryKey: ['tracking-live'],
    queryFn: () => api('/tracking/live'),
    refetchInterval: 20_000,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Live tracking" subtitle="Loading positions" />
        <LoadingBlock rows={5} />
      </>
    );
  }
  if (isError) {
    return (
      <>
        <PageHeader title="Live tracking" />
        <ErrorBlock message={(error as Error).message} onRetry={() => refetch()} />
      </>
    );
  }

  const rows = data ?? [];
  const active = rows.filter((r) => statusOf(r) !== 'offline');
  const visible = onlyActive ? active : rows;
  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  // Fit the real coordinates into the canvas, so markers sit in relative
  // positions that match the ground even without a map tile layer.
  const withCoords = visible.filter((r) => r.latitude != null && r.longitude != null);
  const lats = withCoords.map((r) => r.latitude!);
  const lngs = withCoords.map((r) => r.longitude!);
  const bounds = {
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
    minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
  };
  const project = (r: LiveRow) => {
    const latSpan = bounds.maxLat - bounds.minLat || 1;
    const lngSpan = bounds.maxLng - bounds.minLng || 1;
    return {
      x: 12 + ((r.longitude! - bounds.minLng) / lngSpan) * 74,
      y: 84 - ((r.latitude! - bounds.minLat) / latSpan) * 68,
    };
  };

  return (
    <>
      <PageHeader
        title="Live tracking"
        subtitle={`${active.length} on duty · positions update every 20 seconds`}
        actions={
          <>
            <Button
              variant={onlyActive ? 'ghost' : 'primary'}
              onClick={() => setOnlyActive(false)}
            >
              All ({rows.length})
            </Button>
            <Button
              variant={onlyActive ? 'primary' : 'ghost'}
              onClick={() => setOnlyActive(true)}
            >
              On duty ({active.length})
            </Button>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyBlock
          title="No employees yet"
          message="Add your field team first — their positions appear here once they start duty from the mobile app."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="relative h-[560px] overflow-hidden rounded-xl2 border border-line bg-[#EEF1F8]">
            {hasMapsKey() ? (
              <GoogleMapView
                markers={withCoords.map((r) => ({
                  id: r.id,
                  lat: r.latitude!,
                  lng: r.longitude!,
                  label: r.full_name,
                  color: meta[statusOf(r)].pin,
                  selected: selected?.id === r.id,
                }))}
                onSelect={setSelectedId}
              />
            ) : (
              <>
                <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                  <defs>
                    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
                      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#DFE4EF" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  <path d="M 0 220 Q 220 180 400 260 T 900 300" stroke="#D3DAE9" strokeWidth="14" fill="none" />
                  <path d="M 300 0 Q 340 200 260 420 T 320 600" stroke="#D3DAE9" strokeWidth="12" fill="none" />
                </svg>

                {withCoords.map((r) => {
                  const st = statusOf(r);
                  const pos = project(r);
                  const isSel = selected?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                    >
                      {isSel && (
                        <span
                          className="absolute inset-0 -m-3 animate-ping rounded-full opacity-40"
                          style={{ background: meta[st].pin }}
                        />
                      )}
                      <span
                        className={`relative flex items-center gap-2 rounded-full border-2 border-white py-1 pl-1 pr-3 shadow-md transition ${
                          isSel ? 'scale-105' : 'hover:scale-105'
                        }`}
                        style={{ background: meta[st].pin }}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-[10px] font-bold text-white">
                          {r.full_name.split(' ').map((p) => p[0]).join('')}
                        </span>
                        <span className="whitespace-nowrap text-[11.5px] font-semibold text-white">
                          {r.full_name.split(' ')[0]}
                        </span>
                      </span>
                    </button>
                  );
                })}

                <p className="absolute right-4 top-4 rounded-lg bg-warn-wash px-3 py-1.5 text-[11.5px] font-medium text-warn-ink">
                  Positions are real; the base map needs a Maps API key
                </p>
              </>
            )}

            <div className="absolute bottom-4 left-4 rounded-xl border border-line bg-white/95 px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold text-muted">Status</p>
              <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
                {Object.entries(meta).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: v.pin }} />
                    {v.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {selected ? (
            <Panel row={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="flex h-[560px] items-center justify-center rounded-xl2 border border-line bg-white p-8 text-center">
              <p className="text-sm text-muted">
                Select a marker to see duty, visits and battery for that employee.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Panel({ row, onClose }: { row: LiveRow; onClose: () => void }) {
  const navigate = useNavigate();
  const st = statusOf(row);

  return (
    <div className="h-[560px] overflow-y-auto rounded-xl2 border border-line bg-white">
      <div className="flex items-start gap-3 border-b border-line p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-wash text-sm font-bold text-indigo-deep">
          {row.full_name.split(' ').map((p) => p[0]).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{row.full_name}</p>
          <p className="text-xs text-muted">{row.employee_code}</p>
          <div className="mt-2">
            <Badge tone={meta[st].tone} dot>{meta[st].label}</Badge>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-canvas">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
        <Metric icon={Battery} value={row.battery == null ? '—' : `${row.battery}%`} label="Battery" />
        <Metric icon={Gauge} value={`${Math.round(num(row.speed))} km/h`} label="Speed" />
        <Metric icon={Clock} value={sinceLabel(row.last_seen)} label="Last ping" />
      </div>

      <div className="space-y-4 p-5">
        {!row.tracking_enabled && (
          <div className="rounded-xl bg-warn-wash p-3.5 text-[13px] text-warn-ink">
            Tracking is turned off for this employee, so no location is recorded.
          </div>
        )}
        {row.current_customer && (
          <div className="rounded-xl bg-indigo-wash p-3.5">
            <p className="text-[11px] font-semibold text-indigo-deep">Checked in at</p>
            <p className="mt-1 text-sm font-semibold text-indigo-deep">{row.current_customer}</p>
          </div>
        )}

        <Row label="Territory" value={row.territory ?? '—'} />
        <Row label="Team" value={row.team ?? '—'} />
        <Row label="Attendance" value={row.attendance_status.replace('_', ' ')} />
        <Row
          label="Duty started"
          value={row.start_time
            ? new Date(row.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : 'Not started'}
        />
        <Row label="Visits today" value={`${num(row.visits_done)} of ${num(row.visits_planned)}`} />
        <Row label="Distance today" value={km(num(row.distance_meters))} />
        <Row label="Sales today" value={compactInr(num(row.sales_today))} />

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" icon={Phone}>Call</Button>
          <Button icon={Navigation} onClick={() => navigate(`/routes?employeeId=${row.id}`)}>
            View route
          </Button>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="px-3 py-4 text-center">
      <Icon size={15} className="mx-auto text-muted" />
      <p className="mt-1.5 text-[13px] font-semibold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
