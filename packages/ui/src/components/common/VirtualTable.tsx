import { ReactNode, useMemo, useState } from 'react';
import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { twMerge } from 'tailwind-merge';
import { MdArrowUpward, MdArrowDownward } from 'react-icons/md';

import { Column, FooterColumn } from './Table';

type Props<T> = {
  data: T[];
  columns: Column<T>[];
  footerColumns?: FooterColumn[];
  rowHeight?: number | ((params: { index: number }) => number);
  overscanCount?: number;
  disableHeader?: boolean;
  getRowClassName?: (row: T, index: number) => string | undefined;
};

export const VirtualTable = <T extends object>({
  data,
  columns,
  footerColumns,
  rowHeight = 40,
  overscanCount = 10,
  disableHeader = false,
  getRowClassName,
}: Props<T>) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Apply manual sorting to data
  const sortedData = useMemo(() => {
    if (!sorting.length) {
      return data;
    }

    const sorted = [...data];
    const sortColumn = sorting[0];

    const column = columns.find((col) => col.accessor === sortColumn.id);
    if (!column?.sort) {
      return data;
    }

    return sorted.sort((a, b) => {
      const result = column.sort!(a, b);
      return sortColumn.desc ? -result : result;
    });
  }, [data, columns, sorting]);
  // Convert Column<T> to ColumnDef<T> for @tanstack/react-table
  const tableColumns = useMemo<Array<ColumnDef<T>>>(() => {
    return columns.map((column, index) => ({
      id: (column.accessor as string) || `column-${index}`,
      accessorKey: column.accessor as string,
      header: () => column.header,
      cell: (info) => {
        const value = info.getValue() as T[keyof T] | null;
        const row = info.row.original;
        return column.cell ? column.cell(value, row) : (value as ReactNode);
      },
      size: column.maxWidth ? Number(column.maxWidth) : 200,
      meta: {
        originalColumn: column,
        originalIndex: index,
      },
    }));
  }, [columns]);

  // Create table instance
  const table = useReactTable({
    data: sortedData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    manualSorting: true,
    debugTable: false,
  });

  const { rows } = table.getRowModel();

  // Parent ref for virtualizer
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (typeof rowHeight === 'number' ? rowHeight : 40),
    overscan: overscanCount,
  });

  return (
    <div className="flex-grow flex flex-col border border-border-dark-light">
      {/* Header - Outside virtualized area */}
      {!disableHeader && (
        <div
          className="text-xs text-text-primary uppercase bg-bg-secondary-light border-b border-border-dark-light pr-[8px]"
          key={sorting.map((sort) => `${sort.id}-${sort.desc}`).join(',')}
        >
          <div className="flex">
            {table.getHeaderGroups().map((headerGroup) => (
              <div key={headerGroup.id} className="flex w-full flex-nowrap items-stretch sticky top-0">
                {headerGroup.headers.map((header) => {
                  const headerMeta = header.column.columnDef.meta as { originalColumn: Column<T>; originalIndex: number } | undefined;
                  const originalColumn = headerMeta?.originalColumn;

                  const isSortable = originalColumn?.sort && originalColumn?.accessor;
                  const sortDirection = header.column.getIsSorted();

                  return (
                    <div
                      key={header.id}
                      className={`px-4 py-2 flex items-center text-center flex-shrink-0 ${originalColumn?.headerClassName || ''} ${
                        originalColumn?.align === 'center' ? 'justify-center' : originalColumn?.align === 'right' ? 'justify-end' : 'justify-start'
                      }`}
                      style={{
                        maxWidth: originalColumn?.maxWidth,
                        flex: '2',
                        width: 1,
                      }}
                    >
                      <div
                        key={sortDirection || null}
                        className={`flex items-center gap-1 ${isSortable ? 'cursor-pointer hover:text-text-primary' : ''}`}
                        onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDirection === 'asc' && (
                          <MdArrowUpward className={`w-3 h-3 ${sortDirection === 'asc' ? 'text-text-primary' : 'text-text-secondary'}`} />
                        )}
                        {sortDirection === 'desc' && (
                          <MdArrowDownward className={`w-3 h-3 -mt-1 ${sortDirection === 'desc' ? 'text-text-primary' : 'text-text-secondary'}`} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Virtualized body */}
      <div
        ref={parentRef}
        className="flex-grow scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-tertiary overflow-y-scroll relative"
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%' }}>
          <div className="flex flex-col">
            {virtualizer.getVirtualItems().map((virtualRow, index) => {
              const row = rows[virtualRow.index];
              const rowClassName = getRowClassName ? getRowClassName(row.original, virtualRow.index) : undefined;
              return (
                <div
                  key={row.id}
                  className={twMerge(
                    'bg-bg-primary-light border-b border-border-dark-light hover:bg-bg-secondary text-sm flex items-stretch flex-nowrap',
                    rowClassName,
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start - index * virtualRow.size}px)`,
                    width: '100%',
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const columnMeta = cell.column.columnDef.meta as { originalColumn: Column<T>; originalIndex: number } | undefined;
                    const column = columnMeta?.originalColumn;
                    return (
                      <div
                        key={cell.id}
                        className={`px-4 py-2 flex items-center flex-shrink-0 break-words text-ellipsis ${column?.cellClassName || ''} ${
                          column?.align === 'center' ? 'justify-center' : column?.align === 'right' ? 'justify-end' : 'justify-start'
                        }`}
                        style={{
                          maxWidth: column?.maxWidth,
                          flex: '2',
                          width: 1,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer - Outside virtualized area */}
      {footerColumns && (
        <div className="sticky bottom-0 bg-bg-secondary-light text-xs uppercase text-text-primary border-t border-border-dark-light">
          <div className="flex">
            {footerColumns.map((col, index) => (
              <div
                key={index}
                className={`px-4 py-2 font-medium flex items-center flex-shrink-0 whitespace-break-spaces text-ellipsis ${col.className || ''}`}
                style={{
                  maxWidth: columns[index]?.maxWidth,
                  flex: '2',
                  width: 1,
                }}
              >
                {col.cell}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
