import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MapPin,
  CalendarCheck,
  Route,
  Store,
  ClipboardList,
  CheckSquare,
  Receipt,
  CalendarOff,
  Wallet,
  BarChart3,
  Settings,
  Bell,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import clsx from 'clsx';

const nav = [
  { section: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/live', label: 'Live tracking', icon: MapPin },
  ]},
  { section: 'Workforce', items: [
    { to: '/employees', label: 'Employees', icon: Users },
    { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/routes', label: 'Route history', icon: Route },
  ]},
  { section: 'Field', items: [
    { to: '/visits', label: 'Visits', icon: ClipboardList },
    { to: '/customers', label: 'Customers', icon: Store },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/orders', label: 'Orders', icon: Receipt },
    { to: '/expenses', label: 'Expenses', icon: Wallet },
    { to: '/leaves', label: 'Leave requests', icon: CalendarOff },
  ]},
  { section: 'Insight', items: [
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]},
];

export function AppLayout() {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const initials = (user?.full_name ?? user?.username ?? '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-ink lg:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-brand to-duty">
            <MapPin size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold leading-tight text-white">
              FieldForce
            </p>
            <p className="text-[11px] text-slate-400">Admin console</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {nav.map((group) => (
            <div key={group.section} className="mb-5">
              <p className="mb-2 px-3 text-[11px] font-semibold text-slate-500">
                {group.section}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition',
                      isActive
                        ? 'bg-indigo-brand text-white font-semibold'
                        : 'text-slate-400 hover:bg-ink-soft hover:text-slate-200',
                    )
                  }
                >
                  <item.icon size={17} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-line px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-brand text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                {user?.full_name ?? user?.username}
              </p>
              <p className="text-[11px] capitalize text-slate-500">
                {user?.role.toLowerCase().replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-slate-500 hover:bg-ink-soft hover:text-slate-200"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="flex items-center gap-4 px-6 py-4">
            <p className="text-sm font-semibold lg:hidden">FieldForce</p>
            <div className="ml-auto flex items-center gap-3">
              <button className="relative rounded-xl border border-line bg-white p-2.5">
                <Bell size={17} />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-duty ring-2 ring-canvas" />
              </button>
            </div>
          </div>
        </header>

        <main key={location.pathname} className="px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
