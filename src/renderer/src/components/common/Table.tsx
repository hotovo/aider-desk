import { ReactNode } from 'react';

export type Column<T> = {
  accessor?: keyof T;
  header: string;
  cell?: (value: T[keyof T] | null, row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: string | number;
};

export type FooterColumn = {
  cell: ReactNode;
  colSpan?: number;
  className?: string;
};

type Props<T> = {
  data: T[];
  columns: Column<T>[];
  footerColumns?: FooterColumn[];
};

export const Table = <T extends object>({ data, columns, footerColumns }: Props<T>) => {
  return (
    <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-tertiary m-2">
      <div className="border border-border-dark-light">
        <table className="w-full text-sm text-left text-text-primary">
          <thead className="text-xs text-text-primary uppercase bg-bg-secondary-light sticky top-0">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-4 py-2 ${column.headerClassName || ''} ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''}`}
                  style={{ maxWidth: column.maxWidth }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="bg-bg-primary-light border-b border-border-dark-light hover:bg-bg-secondary text-sm">
                {columns.map((column, colIndex) => {
                  const value = column.accessor ? row[column.accessor] : null;
                  return (
                    <td
                      key={colIndex}
                      className={`px-4 py-2 ${column.cellClassName || ''} ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''}`}
                      style={{ maxWidth: column.maxWidth }}
                    >
                      {column.cell ? column.cell(value, row) : (value as ReactNode)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {footerColumns && (
            <tfoot className="sticky bottom-0 bg-bg-secondary-light text-xs uppercase text-text-primary">
              <tr>
                {footerColumns.map((col, index) => (
                  <th key={index} colSpan={col.colSpan} className={`px-4 py-2 font-medium ${col.className || ''}`}>
                    {col.cell}
                  </th>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
