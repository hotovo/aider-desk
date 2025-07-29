import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UsageDataRow } from '@common/types';

import { formatDateByGroup, getPeriodKey } from './utils';

enum GroupBy {
  Year = 'year',
  Month = 'month',
  Day = 'day',
  Hour = 'hour',
}

type Props = {
  data: UsageDataRow[];
  groupBy: GroupBy;
};

export const UsageTable = ({ data, groupBy }: Props) => {
  const { t } = useTranslation();

  // Aggregate data by day
  const aggregatedData = useMemo(() => {
    const aggregatedMap = new Map<string, UsageDataRow>();

    data.forEach((row) => {
      const key = getPeriodKey(row.timestamp, groupBy);

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
  }, [data]);

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

  return (
    <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-700 m-2">
      <div className="border border-neutral-800">
        <table className="w-full text-sm text-left text-neutral-100">
          <thead className="text-xs text-neutral-100 uppercase bg-neutral-800 sticky top-0">
            <tr>
              <th className="px-4 py-2">{t('usageDashboard.table.date')}</th>
              <th className="px-4 py-2">{t('usageDashboard.table.project')}</th>
              <th className="px-4 py-2">{t('usageDashboard.table.model')}</th>
              <th className="px-4 py-2 text-right">{t('usageDashboard.table.input')}</th>
              <th className="px-4 py-2 text-right">{t('usageDashboard.table.output')}</th>
              <th className="px-4 py-2 text-right">{t('usageDashboard.table.cacheRead')}</th>
              <th className="px-4 py-2 text-right">{t('usageDashboard.table.cacheWrite')}</th>
              <th className="px-4 py-2 text-right">{t('usageDashboard.table.totalTokens')}</th>
              <th className="px-4 py-2 text-right">{t('usageDashboard.table.cost')}</th>
            </tr>
          </thead>
          <tbody>
            {aggregatedData.map((row, index) => (
              <tr key={index} className="bg-neutral-900 border-b border-neutral-800 hover:bg-neutral-800/50 text-sm">
                <td className="px-4 py-2 text-xs">{formatDateByGroup(new Date(row.timestamp), groupBy)}</td>
                <td className="px-4 py-2">
                  <div className="whitespace-pre-line text-xs">{row.project}</div>
                </td>
                <td className="px-4 py-2">
                  <div className="whitespace-pre-line text-xs">{row.model}</div>
                </td>
                <td className="px-4 py-2 text-right">{row.input_tokens || 0}</td>
                <td className="px-4 py-2 text-right">{row.output_tokens || 0}</td>
                <td className="px-4 py-2 text-right">{row.cache_read_tokens || 0}</td>
                <td className="px-4 py-2 text-right">{row.cache_write_tokens || 0}</td>
                <td className="px-4 py-2 text-right">{(row.input_tokens || 0) + (row.output_tokens || 0)}</td>
                <td className="px-4 py-2 text-right">${(row.cost || 0).toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-neutral-800 text-xs uppercase text-neutral-100">
            <tr>
              <th colSpan={3} className="px-4 py-2 text-left font-medium">
                {t('usageDashboard.total')}
              </th>
              <th className="px-4 py-2 text-right font-medium">{totals.input}</th>
              <th className="px-4 py-2 text-right font-medium">{totals.output}</th>
              <th className="px-4 py-2 text-right font-medium">{totals.cacheRead}</th>
              <th className="px-4 py-2 text-right font-medium">{totals.cacheWrite}</th>
              <th className="px-4 py-2 text-right font-medium">{totals.totalTokens}</th>
              <th className="px-4 py-2 text-right font-medium">${totals.cost.toFixed(6)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
