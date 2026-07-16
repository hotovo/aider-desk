import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UsageDataRow } from '@common/types';

import { formatDateByGroup, GroupBy } from './utils';

type Props = {
  data: UsageDataRow[];
  groupBy: GroupBy;
};

export const CacheHitRateTrendChart = ({ data, groupBy }: Props) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    const aggregatedMap = new Map<string, { sentTokens: number; cacheReadTokens: number }>();

    data.forEach((row) => {
      const date = formatDateByGroup(row.timestamp, groupBy);
      const existing = aggregatedMap.get(date) || { sentTokens: 0, cacheReadTokens: 0 };

      aggregatedMap.set(date, {
        sentTokens: existing.sentTokens + (row.input_tokens || 0) + (row.cache_read_tokens || 0),
        cacheReadTokens: existing.cacheReadTokens + (row.cache_read_tokens || 0),
      });
    });

    return Array.from(aggregatedMap.entries())
      .map(([date, { sentTokens, cacheReadTokens }]) => ({
        date,
        cacheHitRate: sentTokens > 0 ? (cacheReadTokens / sentTokens) * 100 : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, groupBy]);

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  if (chartData.length === 0) {
    return (
      <div className="flex-grow flex items-center justify-center text-text-muted-light">
        <div className="text-center">
          <div className="text-lg mb-2">{t('usageDashboard.charts.noData')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow p-2">
      <div className="bg-bg-primary-light border border-border-dark-light p-4">
        <h3 className="text-sm font-medium text-text-primary mb-4">{t('usageDashboard.charts.cacheHitRateTrend')}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3d4166" />
            <XAxis dataKey="date" stroke="#8c8e95" fontSize={12} />
            <YAxis tickFormatter={formatPercentage} stroke="#8c8e95" fontSize={12} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid #2a2c3f',
                borderRadius: '6px',
                color: 'var(--color-text-primary)',
              }}
              wrapperClassName="text-xs"
              formatter={(value: number) => [formatPercentage(value), t('usageDashboard.charts.cacheHitRate')]}
            />
            <Legend formatter={() => <span className="mr-2 text-xs">{t('usageDashboard.charts.cacheHitRate')}</span>} />
            <Line type="monotone" dataKey="cacheHitRate" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
