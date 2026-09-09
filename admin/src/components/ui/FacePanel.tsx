import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ScanFace, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { Badge } from './Badge';
import { Button } from './PageHeader';
import { LoadingBlock } from './States';

import { apiOrigin } from '../../lib/api';

const API_ORIGIN = apiOrigin;

export const photoUrl = (path: string | null) =>
  path ? `${API_ORIGIN}${path}` : null;

interface Props {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

export function FacePanel({ employeeId, employeeName, onClose }: Props) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['face', employeeId],
    queryFn: () => api(`/face/employees/${employeeId}`),
  });

  const reset = useMutation({
    mutationFn: () => api(`/face/employees/${employeeId}/reset`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['face', employeeId] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      setConfirming(false);
    },
  });

  const enrollment = data?.enrollment;
  const history = data?.history ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} role="presentation" />
      <div className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-bold tracking-[-0.02em]">Face registration</h2>
            <p className="mt-0.5 text-sm text-muted">{employeeName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-canvas">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          {isLoading ? (
            <LoadingBlock rows={3} />
          ) : !enrollment ? (
            <div className="rounded-xl2 border border-line p-8 text-center">
              <span className="mx-auto inline-flex rounded-2xl bg-warn-wash p-3 text-warn-ink">
                <ScanFace size={22} />
              </span>
              <p className="mt-4 font-semibold">Not registered yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-muted">
                {employeeName.split(' ')[0]} registers their face from the mobile
                app at first sign-in. Until then they cannot start duty.
              </p>
            </div>
          ) : (
            <>
              <div className="flex gap-4">
                {photoUrl(enrollment.reference_photo) && (
                  <img
                    src={photoUrl(enrollment.reference_photo)!}
                    alt={`Registered face of ${employeeName}`}
                    className="h-28 w-24 rounded-xl border border-line object-cover"
                  />
                )}
                <div className="flex-1 space-y-2 text-sm">
                  <Badge tone={enrollment.status === 'active' ? 'ok' : 'warn'}>
                    {enrollment.status === 'active' ? 'Registered' : enrollment.status}
                  </Badge>
                  <p className="text-muted">
                    Registered{' '}
                    {new Date(enrollment.enrolled_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  {enrollment.device_info && (
                    <p className="text-xs text-muted">On {enrollment.device_info}</p>
                  )}
                  {enrollment.consent_at && (
                    <p className="text-xs text-muted">Consent recorded</p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-[13px] font-semibold">Recent checks</p>
                {history.length === 0 ? (
                  <p className="text-sm text-muted">No checks recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
                      >
                        {photoUrl(h.selfie) ? (
                          <img
                            src={photoUrl(h.selfie)!}
                            alt=""
                            className="h-10 w-9 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-9 rounded-lg bg-canvas" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium capitalize">
                            {h.context.replace('_', ' ')}
                          </p>
                          <p className="text-[11.5px] text-muted">
                            {new Date(h.created_at).toLocaleString('en-IN', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Badge tone={h.passed ? 'ok' : 'bad'}>
                          {h.score != null ? `${Math.round(h.score * 100)}%` : '—'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-7 rounded-xl border border-line p-4">
                <div className="flex gap-2.5">
                  <ShieldAlert size={17} className="mt-0.5 shrink-0 text-muted" />
                  <div>
                    <p className="text-[13px] font-semibold">Reset registration</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Use this when someone changes phone, or when checks keep
                      failing. They will register again at next sign-in and
                      cannot start duty until they do.
                    </p>
                  </div>
                </div>

                {reset.isError && (
                  <p className="mt-3 text-xs text-bad">
                    {(reset.error as Error).message}
                  </p>
                )}

                <div className="mt-4">
                  {confirming ? (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setConfirming(false)}>
                        Keep it
                      </Button>
                      <button
                        onClick={() => reset.mutate()}
                        disabled={reset.isPending}
                        className="rounded-xl bg-bad px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {reset.isPending ? 'Resetting…' : 'Yes, reset'}
                      </button>
                    </div>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirming(true)}>
                      Reset face registration
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
