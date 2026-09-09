import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl2 border border-line bg-white"
        />
      ))}
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl2 border border-line bg-white p-10 text-center">
      <span className="mx-auto inline-flex rounded-2xl bg-bad-wash p-3 text-bad">
        <AlertCircle size={22} />
      </span>
      <p className="mt-4 font-semibold">Could not load this</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:bg-canvas"
        >
          <RefreshCw size={15} />
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl2 border border-line bg-white p-12 text-center">
      <span className="mx-auto inline-flex rounded-2xl bg-indigo-wash p-3 text-indigo-brand">
        <Inbox size={22} />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{message}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Toast({
  message,
  tone = 'ok',
}: {
  message: string;
  tone?: 'ok' | 'bad';
}) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
        tone === 'ok' ? 'bg-ink' : 'bg-bad'
      }`}
    >
      {message}
    </div>
  );
}
