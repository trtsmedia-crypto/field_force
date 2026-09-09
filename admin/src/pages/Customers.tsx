import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States';
import { api, num } from '../lib/api';
import { inr } from '../lib/format';

interface CustomerRow {
  id: string;
  customer_code: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  area: string | null;
  territory: string | null;
  category: string | null;
  assigned_to: string | null;
  outstanding: number;
  status: string;
  last_visit: string | null;
}

export function Customers() {
  const [query, setQuery] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery<CustomerRow[]>({
    queryKey: ['customers', query],
    queryFn: () => api(`/customers?search=${encodeURIComponent(query)}`),
  });

  const totalOutstanding = (data ?? []).reduce(
    (sum, c) => sum + num(c.outstanding), 0,
  );

  const columns: Column<CustomerRow>[] = [
    {
      key: 'business', header: 'Business',
      render: (c) => (
        <div>
          <p className="font-semibold">{c.business_name}</p>
          <p className="text-xs text-muted">
            {c.customer_code} · {c.category ?? 'Uncategorised'}
          </p>
        </div>
      ),
    },
    {
      key: 'contact', header: 'Contact',
      render: (c) => (
        <div>
          <p>{c.contact_name ?? '—'}</p>
          <p className="text-xs text-muted">{c.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'location', header: 'Location',
      render: (c) => (
        <div>
          <p>{c.area ?? '—'}</p>
          <p className="text-xs text-muted">{c.territory ?? 'No territory'}</p>
        </div>
      ),
    },
    {
      key: 'assigned', header: 'Assigned to',
      render: (c) =>
        c.assigned_to ?? <span className="text-muted">Unassigned</span>,
    },
    {
      key: 'lastVisit', header: 'Last visit',
      render: (c) =>
        c.last_visit
          ? new Date(c.last_visit).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short',
            })
          : <span className="text-muted">Never</span>,
    },
    {
      key: 'outstanding', header: 'Outstanding', align: 'right',
      render: (c) =>
        num(c.outstanding) > 0 ? (
          <span className="font-semibold text-bad">{inr(num(c.outstanding))}</span>
        ) : (
          <span className="text-muted">Clear</span>
        ),
    },
    {
      key: 'status', header: 'Status', align: 'right',
      render: (c) => (
        <Badge tone={c.status === 'active' ? 'ok' : 'neutral'}>
          {c.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={
          data
            ? `${data.length} customers · ${inr(totalOutstanding)} outstanding`
            : undefined
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search business or area"
          className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-muted focus:border-indigo-brand"
        />
      </div>

      {isLoading ? (
        <LoadingBlock rows={5} />
      ) : isError ? (
        <ErrorBlock message={(error as Error).message} onRetry={() => refetch()} />
      ) : (data ?? []).length === 0 ? (
        <EmptyBlock
          title={query ? `No customer matches "${query}"` : 'No customers yet'}
          message="Customers you add appear here, along with who they are assigned to and what they owe."
        />
      ) : (
        <DataTable columns={columns} rows={data ?? []} />
      )}
    </>
  );
}
