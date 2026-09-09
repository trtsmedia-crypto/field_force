import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Search, Copy, Check, ScanFace, MoreVertical, UserX, UserCheck2, Trash2 } from 'lucide-react';
import { FacePanel } from '../components/ui/FacePanel';
import { PageHeader, Button } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import type { Tone } from '../components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock, Toast } from '../components/ui/States';
import { api, num } from '../lib/api';
import { compactInr, km } from '../lib/format';

interface EmployeeRow {
  id: string;
  employee_code: string;
  full_name: string;
  designation: string | null;
  territory: string | null;
  team: string | null;
  email: string | null;
  mobile: string | null;
  status: string;
  attendance_status: string;
  distance_meters: number | null;
  visits_done: string;
  visits_planned: string;
  sales_today: number;
  face_status: string;
  face_enrolled_at: string | null;
  face_required: boolean;
}

const attendanceTone: Record<string, Tone> = {
  present: 'ok', late: 'warn', absent: 'bad', on_leave: 'indigo',
  half_day: 'neutral', holiday: 'neutral', anomaly: 'bad',
};

export function Employees() {
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [facePanel, setFacePanel] = useState<EmployeeRow | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const qc = useQueryClient();

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/employees/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setMenuFor(null);
    },
  });

  const remove = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      api(`/employees/${id}`, { method: 'DELETE', body: force ? { force: true } : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setMenuFor(null);
      setToast('Employee deleted.');
      setTimeout(() => setToast(null), 4000);
    },
    onError: (err: Error, variables) => {
      setMenuFor(null);
      // The server refused because this employee has history. Offer the
      // forced path only here, as a second, harder-to-hit confirmation —
      // never as the default one-click action.
      if (!variables.force && err.message.includes('confirm a forced delete')) {
        const reallyDelete = confirm(
          `${err.message}\n\n` +
            `Choosing OK permanently erases this employee's attendance, visits, ` +
            `orders and tasks. This cannot be undone. Are you certain?`,
        );
        if (reallyDelete) {
          remove.mutate({ id: variables.id, force: true });
        }
        return;
      }
      alert(err.message);
    },
  });

  const { data, isLoading, isError, error, refetch } = useQuery<EmployeeRow[]>({
    queryKey: ['employees', query],
    queryFn: () => api(`/employees?search=${encodeURIComponent(query)}`),
  });

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (e) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-wash text-[11px] font-bold text-indigo-deep">
            {e.full_name.split(' ').map((p) => p[0]).join('')}
          </div>
          <div>
            <p className="font-semibold">{e.full_name}</p>
            <p className="text-xs text-muted">{e.employee_code}</p>
          </div>
        </div>
      ),
    },
    { key: 'designation', header: 'Designation', render: (e) => e.designation ?? '—' },
    {
      key: 'territory',
      header: 'Territory',
      render: (e) => (
        <div>
          <p>{e.territory ?? '—'}</p>
          <p className="text-xs text-muted">{e.team ?? 'No team'}</p>
        </div>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      render: (e) => (
        <Badge tone={e.status === 'active' ? 'ok' : 'bad'}>
          {e.status[0].toUpperCase() + e.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'attendance',
      header: 'Today',
      render: (e) => (
        <Badge tone={attendanceTone[e.attendance_status] ?? 'neutral'}>
          {e.attendance_status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'face', header: 'Face',
      render: (e) => (
        <button
          onClick={() => setFacePanel(e)}
          className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-canvas"
        >
          <ScanFace size={15} className="text-muted" />
          {!e.face_required ? (
            <Badge tone="neutral">Not required</Badge>
          ) : e.face_status === 'active' ? (
            <Badge tone="ok">Registered</Badge>
          ) : (
            <Badge tone="warn">Pending</Badge>
          )}
        </button>
      ),
    },
    {
      key: 'visits', header: 'Visits', align: 'right',
      render: (e) => `${num(e.visits_done)}/${num(e.visits_planned)}`,
    },
    {
      key: 'distance', header: 'Distance', align: 'right',
      render: (e) => km(num(e.distance_meters)),
    },
    {
      key: 'sales', header: 'Sales today', align: 'right',
      render: (e) => <span className="font-semibold">{compactInr(num(e.sales_today))}</span>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (e) => (
        <div className="relative inline-block text-left">
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              setMenuFor(menuFor === e.id ? null : e.id);
            }}
            className="rounded-lg p-1.5 text-muted hover:bg-canvas"
          >
            <MoreVertical size={16} />
          </button>
          {menuFor === e.id && (
            <div
              className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-white py-1 shadow-lg"
              onClick={(ev) => ev.stopPropagation()}
            >
              {e.status === 'active' ? (
                <button
                  onClick={() => setStatus.mutate({ id: e.id, status: 'inactive' })}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] hover:bg-canvas"
                >
                  <UserX size={14} className="text-warn-ink" /> Deactivate
                </button>
              ) : (
                <button
                  onClick={() => setStatus.mutate({ id: e.id, status: 'active' })}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] hover:bg-canvas"
                >
                  <UserCheck2 size={14} className="text-ok" /> Activate
                </button>
              )}
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Delete ${e.full_name}? This only works if they have no attendance, visit, order or task history.`,
                    )
                  ) {
                    remove.mutate({ id: e.id });
                  }
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-bad hover:bg-bad-wash"
              >
                <Trash2 size={14} /> Delete
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
        title="Employees"
        subtitle={data ? `${data.length} employees` : undefined}
        actions={<Button icon={UserPlus} onClick={() => setDrawer(true)}>Add employee</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, code or territory"
          className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-muted focus:border-indigo-brand"
        />
      </div>

      {menuFor && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
      )}
      {isLoading ? (
        <LoadingBlock rows={5} />
      ) : isError ? (
        <ErrorBlock message={(error as Error).message} onRetry={() => refetch()} />
      ) : (data ?? []).length === 0 ? (
        <EmptyBlock
          title={query ? `No employee matches "${query}"` : 'No employees yet'}
          message={
            query
              ? 'Try a different name, employee code or territory.'
              : 'Add your first field employee to get started. They sign in to the mobile app with the credentials you set here.'
          }
          action={!query && <Button icon={UserPlus} onClick={() => setDrawer(true)}>Add employee</Button>}
        />
      ) : (
        <DataTable columns={columns} rows={data ?? []} />
      )}

      {drawer && (
        <OnboardingDrawer
          onClose={() => setDrawer(false)}
          onCreated={(msg) => {
            setDrawer(false);
            setToast(msg);
            setTimeout(() => setToast(null), 5000);
          }}
        />
      )}
      {facePanel && (
        <FacePanel
          employeeId={facePanel.id}
          employeeName={facePanel.full_name}
          onClose={() => setFacePanel(null)}
        />
      )}
      {toast && <Toast message={toast} />}
    </>
  );
}

function OnboardingDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    fullName: '', employeeCode: '', mobile: '', email: '',
    designation: 'Field Sales Executive', city: 'Jammu',
    teamId: '', territoryId: '', password: '',
    trackingEnabled: true, attendanceEnabled: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const territories = useQuery({
    queryKey: ['territories'], queryFn: () => api('/lookups/territories'),
  });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => api('/lookups/teams') });

  const create = useMutation({
    mutationFn: () =>
      api('/employees', {
        method: 'POST',
        body: {
          ...form,
          teamId: form.teamId || null,
          territoryId: form.territoryId || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      onCreated(
        `${form.fullName} added. Share the password — they register their face at first sign-in.`,
      );
    },
    onError: (err: Error) => setError(err.message),
  });

  const suggestPassword = () => {
    const value = `Field${Math.floor(1000 + Math.random() * 9000)}!`;
    setForm({ ...form, password: value });
  };

  const set = (k: keyof typeof form) => (e: any) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} role="presentation" />
      <div className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-line bg-white px-6 py-5">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Add employee</h2>
          <p className="mt-1 text-sm text-muted">
            They sign in to the mobile app with the employee ID and this
            temporary password, then set their own.
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-5 rounded-xl bg-bad-wash px-4 py-3 text-[13px] text-bad">
            {error}
          </div>
        )}

        <div className="space-y-5 px-6 py-6">
          <Field label="Full name" value={form.fullName} onChange={set('fullName')} placeholder="e.g. Rahul Sharma" />
          <Field label="Employee ID" value={form.employeeCode} onChange={set('employeeCode')} placeholder="EMP-1080" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mobile" value={form.mobile} onChange={set('mobile')} placeholder="+91" />
            <Field label="City" value={form.city} onChange={set('city')} placeholder="Jammu" />
          </div>
          <Field label="Email (optional)" value={form.email} onChange={set('email')} placeholder="name@company.com" />
          <Field label="Designation" value={form.designation} onChange={set('designation')} placeholder="Field Sales Executive" />

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Territory</span>
              <select
                value={form.territoryId}
                onChange={set('territoryId')}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
              >
                <option value="">Not assigned</option>
                {(territories.data ?? []).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Team</span>
              <select
                value={form.teamId}
                onChange={set('teamId')}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
              >
                <option value="">Not assigned</option>
                {(teams.data ?? []).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-semibold">Temporary password</span>
              <button onClick={suggestPassword} className="text-xs font-semibold text-indigo-brand">
                Generate
              </button>
            </div>
            <div className="relative">
              <input
                value={form.password}
                onChange={set('password')}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 pr-11 text-sm outline-none placeholder:text-muted focus:border-indigo-brand"
              />
              {form.password && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(form.password);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                  aria-label="Copy password"
                >
                  {copied ? <Check size={16} className="text-ok" /> : <Copy size={16} />}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-line p-4">
            <Toggle
              label="Location tracking"
              hint="Recorded only between start and end of duty"
              value={form.trackingEnabled}
              onChange={(v) => setForm({ ...form, trackingEnabled: v })}
            />
            <Toggle
              label="Attendance"
              hint="Lets them start and end duty from the app"
              value={form.attendanceEnabled}
              onChange={(v) => setForm({ ...form, attendanceEnabled: v })}
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-line bg-white px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { setError(null); create.mutate(); }}>
            {create.isPending ? 'Creating…' : 'Create employee'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: any) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold">{label}</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-indigo-brand"
      />
    </label>
  );
}

function Toggle({
  label, hint, value, onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`h-6 w-11 rounded-full p-0.5 transition ${value ? 'bg-indigo-brand' : 'bg-slate-300'}`}
        aria-pressed={value}
      >
        <span className={`block h-5 w-5 rounded-full bg-white transition ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
