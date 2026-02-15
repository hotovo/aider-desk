import React, { ReactNode, useState } from 'react';
import { MdArrowUpward, MdArrowDownward } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

export type Column<T> = {
  accessor?: keyof T;
  header: ReactNode;
  cell?: (value: T[keyof T] | null, row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: string | number;
  sort?: (a: T, b: T) => number;
};

export type FooterColumn = {
  cell: ReactNode;
  colSpan?: number;
  className?: string;
};

type SortState = {
  columnKey: string;
  direction: 'asc' | 'desc' | null;
};

type Props<T> = {
  data: T[];
  columns: Column<T>[];
  footerColumns?: FooterColumn[];
};

export const Table = <T extends object>({ data, columns, footerColumns }: Props<T>) => {
  const { t } = useTranslation();
  const [sortState, setSortState] = useState<SortState>({ columnKey: '', direction: null });

  const handleSort = (column: Column<T>) => {
    if (!column.sort || !column.accessor) {
      return;
    }

    const accessorKey = String(column.accessor);
    if (sortState.columnKey === accessorKey && sortState.direction === 'desc') {
      setSortState({ columnKey: '', direction: null });
      return;
    }

    const newDirection = sortState.columnKey === accessorKey && sortState.direction === 'asc' ? 'desc' : 'asc';
    setSortState({ columnKey: accessorKey, direction: newDirection });
  };

  const sortedData = React.useMemo(() => {
    if (!sortState.columnKey || !sortState.direction) {
      return data;
    }

    const column = columns.find((col) => String(col.accessor) === sortState.columnKey);
    if (!column?.sort) {
      return data;
    }

    return [...data].sort((a, b) => {
      const result = column.sort!(a, b);
      return sortState.direction === 'desc' ? -result : result;
    });
  }, [data, columns, sortState]);

  return (
    <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-tertiary m-2">
      <div className="border border-border-dark-light">
        <table className="w-full text-sm text-left text-text-primary">
          <thead className="text-xs text-text-primary uppercase bg-bg-secondary-light sticky top-0">
            <tr>
              {columns.map((column, index) => {
                const isSortable = column.sort && column.accessor;
                const isSorted = sortState.columnKey === column.accessor;
                const sortDirection = isSorted ? sortState.direction : null;

                return (
                  <th key={index} className={`px-4 py-2 ${column.headerClassName || ''}`} style={{ maxWidth: column.maxWidth }}>
                    <div
                      className={`flex items-center gap-1 ${isSortable ? 'cursor-pointer hover:text-text-primary' : ''} ${column.align === 'center' ? 'justify-center' : column.align === 'right' ? 'justify-end' : ''}`}
                      onClick={() => handleSort(column)}
                      title={isSortable ? t('table.sort') : undefined}
                    >
                      <span>{column.header}</span>
                      {sortDirection === 'asc' && (
                        <MdArrowUpward className={`w-3 h-3 ${sortDirection === 'asc' ? 'text-text-primary' : 'text-text-secondary'}`} />
                      )}
                      {sortDirection === 'desc' && (
                        <MdArrowDownward className={`w-3 h-3 -mt-1 ${sortDirection === 'desc' ? 'text-text-primary' : 'text-text-secondary'}`} />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, rowIndex) => (
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
