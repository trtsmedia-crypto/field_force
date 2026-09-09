import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  width?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl2 border border-line bg-white p-12 text-center">
        {empty ?? <p className="text-sm text-muted">Nothing to show yet.</p>}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl2 border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-canvas/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={`px-5 py-3 text-xs font-semibold text-muted ${
                    c.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-line last:border-0 ${
                  onRowClick ? 'cursor-pointer hover:bg-canvas/70' : ''
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-5 py-4 text-sm ${
                      c.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
