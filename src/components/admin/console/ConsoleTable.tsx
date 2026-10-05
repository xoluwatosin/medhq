import { ReactNode } from "react";

export interface ConsoleColumn {
  key: string;
  label: string;
  width: string;
}

interface ConsoleTableProps<T> {
  columns: readonly ConsoleColumn[];
  rows: readonly T[];
  rowKey: (row: T) => string | number;
  renderRow: (row: T) => ReactNode;
  className?: string;
}

const ConsoleTable = <T,>({ columns, rows, rowKey, renderRow, className }: ConsoleTableProps<T>) => (
  <div className={className ?? "hidden overflow-hidden border-2 border-navy bg-card shadow-offset md:block"}>
    <table className="w-full table-fixed border-collapse text-left text-sm text-body">
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={{ width: column.width }} />
        ))}
      </colgroup>
      <thead className="bg-navy text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
        <tr className="h-10">
          {columns.map((column) => (
            <th key={column.key} scope="col" className="border-r border-white/15 px-3 py-2 !text-white last:border-r-0">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="min-h-[64px] border-b border-line-soft last:border-b-0 hover:bg-background">
            {renderRow(row)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ConsoleTable;
