import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ScanFace, MapPinned, Users2, History } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { LoadingBlock, ErrorBlock } from '../components/ui/States';
import { api, num } from '../lib/api';

interface FaceSettings {
  threshold: number;
  maxAttempts: number;
  requireForDuty: boolean;
}

export function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api('/settings') });
  const territories = useQuery({ queryKey: ['territories'], queryFn: () => api('/lookups/territories') });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => api('/lookups/teams') });
  const audit = useQuery({ queryKey: ['audit-logs'], queryFn: () => api('/audit-logs?limit=15') });

  const face: FaceSettings = settings.data?.face ?? {
    threshold: 0.7, maxAttempts: 5, requireForDuty: true,
  };
  const [threshold, setThreshold] = useState(face.threshold);
  const [maxAttempts, setMaxAttempts] = useState(face.maxAttempts);

  const saveFace = useMutation({
    mutationFn: (value: FaceSettings) =>
      api('/settings/face', { method: 'PUT', body: { value } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const [newTerritory, setNewTerritory] = useState('');
  const addTerritory = useMutation({
    mutationFn: (name: string) =>
      api('/settings/territories', { method: 'POST', body: { name } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['territories'] });
      setNewTerritory('');
    },
  });
  const removeTerritory = useMutation({
    mutationFn: (id: string) => api(`/settings/territories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['territories'] }),
    onError: (err: Error) => alert(err.message),
  });

  const [newTeam, setNewTeam] = useState('');
  const addTeam = useMutation({
    mutationFn: (name: string) => api('/settings/teams', { method: 'POST', body: { name } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      setNewTeam('');
    },
  });
  const removeTeam = useMutation({
    mutationFn: (id: string) => api(`/settings/teams/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
    onError: (err: Error) => alert(err.message),
  });

  if (settings.isLoading) return <><PageHeader title="Settings" /><LoadingBlock rows={4} /></>;
  if (settings.isError) {
    return <><PageHeader title="Settings" /><ErrorBlock message={(settings.error as Error).message} onRetry={() => settings.refetch()} /></>;
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Face recognition, territories, teams and activity" />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Face recognition"
            subtitle="Attendance check at duty start and end"
          />
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold">Match threshold</span>
                <span className="text-[13px] font-bold text-indigo-brand">
                  {Math.round(threshold * 100)}%
                </span>
              </div>
              <input
                type="range" min={0.5} max={0.9} step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-indigo-brand"
              />
              <p className="mt-1.5 text-xs text-muted">
                Higher is stricter. If genuine employees are being rejected on
                bad-light mornings, lower this slightly.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">
                Failed attempts before lockout message
              </span>
              <input
                type="number" min={3} max={10}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-24 rounded-xl border border-line bg-white px-3.5 py-2 text-sm outline-none focus:border-indigo-brand"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-line p-3.5">
              <div>
                <p className="text-sm font-medium">Require face for duty</p>
                <p className="text-xs text-muted">Turn off to make attendance GPS-only, system-wide</p>
              </div>
              <input
                type="checkbox"
                checked={face.requireForDuty}
                onChange={(e) =>
                  saveFace.mutate({ threshold, maxAttempts, requireForDuty: e.target.checked })
                }
                className="h-5 w-5 accent-indigo-brand"
              />
            </label>

            {saveFace.isError && (
              <p className="text-xs text-bad">{(saveFace.error as Error).message}</p>
            )}

            <button
              onClick={() => saveFace.mutate({ threshold, maxAttempts, requireForDuty: face.requireForDuty })}
              disabled={saveFace.isPending}
              className="rounded-xl bg-indigo-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saveFace.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Territories" subtitle="Areas your team covers" />
          <div className="mb-4 flex gap-2">
            <input
              value={newTerritory}
              onChange={(e) => setNewTerritory(e.target.value)}
              placeholder="e.g. Udhampur"
              className="flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            />
            <button
              onClick={() => newTerritory.trim() && addTerritory.mutate(newTerritory.trim())}
              className="rounded-xl bg-indigo-brand px-3.5 text-white"
            >
              <Plus size={18} />
            </button>
          </div>
          {territories.isLoading ? (
            <LoadingBlock rows={2} />
          ) : (territories.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">No territories yet.</p>
          ) : (
            <div className="space-y-2">
              {(territories.data ?? []).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5">
                  <span className="text-sm">{t.name}</span>
                  <button
                    onClick={() => removeTerritory.mutate(t.id)}
                    className="text-muted hover:text-bad"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Teams" subtitle="Groups your employees are organised into" />
          <div className="mb-4 flex gap-2">
            <input
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              placeholder="e.g. Team Delta"
              className="flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand"
            />
            <button
              onClick={() => newTeam.trim() && addTeam.mutate(newTeam.trim())}
              className="rounded-xl bg-indigo-brand px-3.5 text-white"
            >
              <Plus size={18} />
            </button>
          </div>
          {teams.isLoading ? (
            <LoadingBlock rows={2} />
          ) : (teams.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">No teams yet.</p>
          ) : (
            <div className="space-y-2">
              {(teams.data ?? []).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5">
                  <span className="text-sm">{t.name}</span>
                  <button onClick={() => removeTeam.mutate(t.id)} className="text-muted hover:text-bad">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent admin activity" subtitle="Who changed what" />
          {audit.isLoading ? (
            <LoadingBlock rows={4} />
          ) : (audit.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {(audit.data ?? []).map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 text-[13px]">
                  <History size={15} className="mt-0.5 shrink-0 text-muted" />
                  <div>
                    <p>
                      <span className="font-medium">{a.email ?? a.username ?? 'System'}</span>{' '}
                      <span className="text-muted">{a.action.replace(/_/g, ' ')}</span>
                    </p>
                    <p className="text-[11px] text-muted">
                      {new Date(a.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
