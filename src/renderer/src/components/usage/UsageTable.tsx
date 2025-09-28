import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UsageDataRow } from '@common/types';

import { formatDateByGroup, GroupBy } from './utils';

import { Column, FooterColumn, Table } from '@/components/common/Table';

type Props = {
  data: UsageDataRow[];
  groupBy: GroupBy;
};

export const UsageTable = ({ data, groupBy }: Props) => {
  const { t } = useTranslation();

  const aggregatedData = useMemo(() => {
    const aggregatedMap = new Map<string, UsageDataRow>();

    data.forEach((row) => {
      const key = formatDateByGroup(row.timestamp, groupBy);

      if (aggregatedMap.has(key)) {
        const existing = aggregatedMap.get(key)!;
        const newProjects = new Set(existing.project.split('\n'));
        newProjects.add(row.project.split(/[\\/]/).pop() || row.project);
        const newModels = new Set(existing.model.split('\n'));
        newModels.add(row.model);

        aggregatedMap.set(key, {
          ...existing,
          project: [...newProjects].join('\n'),
          model: [...newModels].join('\n'),
          input_tokens: (existing.input_tokens || 0) + (row.input_tokens || 0),
          output_tokens: (existing.output_tokens || 0) + (row.output_tokens || 0),
          cache_read_tokens: (existing.cache_read_tokens || 0) + (row.cache_read_tokens || 0),
          cache_write_tokens: (existing.cache_write_tokens || 0) + (row.cache_write_tokens || 0),
          cost: (existing.cost || 0) + (row.cost || 0),
        });
      } else {
        aggregatedMap.set(key, {
          ...row,
          project: row.project.split(/[\\/]/).pop() || row.project,
          timestamp: row.timestamp,
        });
      }
    });

    return Array.from(aggregatedMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data, groupBy]);

  const totals = useMemo(() => {
    return aggregatedData.reduce(
      (acc, row) => ({
        input: acc.input + (row.input_tokens || 0),
        output: acc.output + (row.output_tokens || 0),
        cacheRead: acc.cacheRead + (row.cache_read_tokens || 0),
        cacheWrite: acc.cacheWrite + (row.cache_write_tokens || 0),
        totalTokens: acc.totalTokens + (row.input_tokens || 0) + (row.output_tokens || 0),
        cost: acc.cost + (row.cost || 0),
      }),
      {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: 0,
      },
    );
  }, [aggregatedData]);

  const columns: Column<UsageDataRow>[] = [
    {
      accessor: 'timestamp',
      header: t('usageDashboard.table.date'),
      cell: (value) => formatDateByGroup(value as string, groupBy),
      cellClassName: 'text-xs',
    },
    {
      accessor: 'project',
      header: t('usageDashboard.table.project'),
      cell: (value) => <div className="whitespace-pre-line text-xs">{value as string}</div>,
    },
    {
      accessor: 'model',
      header: t('usageDashboard.table.model'),
      cell: (value) => <div className="whitespace-pre-line text-xs">{value as string}</div>,
    },
    {
      accessor: 'input_tokens',
      header: t('usageDashboard.table.input'),
      cell: (value) => (value as number) || 0,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      accessor: 'output_tokens',
      header: t('usageDashboard.table.output'),
      cell: (value) => (value as number) || 0,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      accessor: 'cache_read_tokens',
      header: t('usageDashboard.table.cacheRead'),
      cell: (value) => (value as number) || 0,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      accessor: 'cache_write_tokens',
      header: t('usageDashboard.table.cacheWrite'),
      cell: (value) => (value as number) || 0,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      accessor: 'input_tokens',
      header: t('usageDashboard.table.totalTokens'),
      cell: (_, row) => (row.input_tokens || 0) + (row.output_tokens || 0),
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      accessor: 'cost',
      header: t('usageDashboard.table.cost'),
      cell: (value) => `$${((value as number) || 0).toFixed(6)}`,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
  ];

  const footerColumns: FooterColumn[] = [
    {
      cell: t('usageDashboard.total'),
      colSpan: 3,
      className: 'text-left',
    },
    {
      cell: totals.input,
      className: 'text-right',
    },
    {
      cell: totals.output,
      className: 'text-right',
    },
    {
      cell: totals.cacheRead,
      className: 'text-right',
    },
    {
      cell: totals.cacheWrite,
      className: 'text-right',
    },
    {
      cell: totals.totalTokens,
      className: 'text-right',
    },
    {
      cell: `$${totals.cost.toFixed(6)}`,
      className: 'text-right',
    },
  ];

  return <Table data={aggregatedData} columns={columns} footerColumns={footerColumns} />;
};
