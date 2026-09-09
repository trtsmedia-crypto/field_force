import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  icon: Icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
  icon?: LucideIcon;
}) {
  const base =
    'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition';
  const styles =
    variant === 'primary'
      ? 'bg-indigo-brand text-white hover:bg-indigo-deep'
      : 'border border-line bg-white text-body hover:bg-canvas';
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
