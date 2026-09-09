import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { LiveTracking } from './pages/LiveTracking';
import { Employees } from './pages/Employees';
import { Attendance } from './pages/Attendance';
import { Visits } from './pages/Visits';
import { Customers } from './pages/Customers';
import { Tasks } from './pages/Tasks';
import { Orders } from './pages/Orders';
import { RouteHistory } from './pages/RouteHistory';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { Expenses } from './pages/Expenses';
import { Leaves } from './pages/Leaves';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function Protected() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-indigo-brand" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function LoginGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginGate />} />
            <Route element={<Protected />}>
              <Route index element={<Dashboard />} />
              <Route path="live" element={<LiveTracking />} />
              <Route path="employees" element={<Employees />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="routes" element={<RouteHistory />} />
              <Route path="visits" element={<Visits />} />
              <Route path="customers" element={<Customers />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="orders" element={<Orders />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="leaves" element={<Leaves />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
