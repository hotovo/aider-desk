import { ReactNode, useMemo, useState, useCallback } from 'react';
import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { twMerge } from 'tailwind-merge';
import { MdArrowUpward, MdArrowDownward } from 'react-icons/md';

import { Column, FooterColumn } from './Table';

type SortState = {
  columnKey: string;
  direction: 'asc' | 'desc' | null;
};

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
  const [sortState, setSortState] = useState<SortState>({ columnKey: '', direction: null });

  const handleSort = useCallback(
    (column: Column<T>) => {
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
    },
    [sortState],
  );

  // Apply manual sorting to data
  const sortedData = useMemo(() => {
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

  // Generate row model for virtualizer
  const rows = useMemo(() => sortedData.map((item, index) => ({ original: item, id: `${index}` })), [sortedData]);

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
          key={`${sortState.columnKey}-${sortState.direction}`}
        >
          <div className="flex">
            <div className="flex w-full flex-nowrap items-stretch sticky top-0">
              {columns.map((column, index) => {
                const isSortable = !!column.sort && !!column.accessor;
                const isSorted = sortState.columnKey === column.accessor;
                const sortDirection = isSorted ? sortState.direction : null;

                return (
                  <div
                    key={index}
                    className={`px-4 py-2 flex items-center text-center flex-shrink-0 ${column.headerClassName || ''} ${
                      column.align === 'center' ? 'justify-center' : column.align === 'right' ? 'justify-end' : 'justify-start'
                    }`}
                    style={{
                      maxWidth: column.maxWidth,
                      flex: '2',
                      width: 1,
                    }}
                  >
                    <div
                      key={sortDirection || null}
                      className={`flex items-center gap-1 ${isSortable ? 'cursor-pointer hover:text-text-primary' : ''}`}
                      onClick={() => handleSort(column)}
                    >
                      {column.header}
                      {sortDirection === 'asc' && <MdArrowUpward className="w-3 h-3 text-text-primary" />}
                      {sortDirection === 'desc' && <MdArrowDownward className="w-3 h-3 -mt-1 text-text-primary" />}
                    </div>
                  </div>
                );
              })}
            </div>
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
                  {columns.map((column, colIndex) => {
                    const value = column.accessor ? row.original[column.accessor] : null;
                    return (
                      <div
                        key={colIndex}
                        className={`px-4 py-2 flex items-center flex-shrink-0 break-words text-ellipsis ${column.cellClassName || ''} ${
                          column.align === 'center' ? 'justify-center' : column.align === 'right' ? 'justify-end' : 'justify-start'
                        }`}
                        style={{
                          maxWidth: column.maxWidth,
                          flex: '2',
                          width: 1,
                        }}
                      >
                        {column.cell ? column.cell(value, row.original) : (value as ReactNode)}
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
