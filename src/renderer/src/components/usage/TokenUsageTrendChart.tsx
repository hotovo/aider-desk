import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UsageDataRow } from '@common/types';

import { formatDateByGroup, GroupBy } from './utils';

type ChartDataPoint = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

type Props = {
  data: UsageDataRow[];
  groupBy: GroupBy;
};

export const TokenUsageTrendChart = ({ data, groupBy }: Props) => {
  const { t } = useTranslation();

  // Process data for stacked composition chart (aggregate by period)
  const chartData = useMemo(() => {
    const aggregatedMap = new Map<string, ChartDataPoint>();

    data.forEach((row) => {
      const date = formatDateByGroup(row.timestamp, groupBy);

      if (aggregatedMap.has(date)) {
        const existing = aggregatedMap.get(date)!;
        aggregatedMap.set(date, {
          date,
          inputTokens: existing.inputTokens + (row.input_tokens || 0),
          outputTokens: existing.outputTokens + (row.output_tokens || 0),
          cacheReadTokens: existing.cacheReadTokens + (row.cache_read_tokens || 0),
          cacheWriteTokens: existing.cacheWriteTokens + (row.cache_write_tokens || 0),
        });
      } else {
        aggregatedMap.set(date, {
          date,
          inputTokens: row.input_tokens || 0,
          outputTokens: row.output_tokens || 0,
          cacheReadTokens: row.cache_read_tokens || 0,
          cacheWriteTokens: row.cache_write_tokens || 0,
        });
      }
    });

    return Array.from(aggregatedMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, groupBy]);

  const formatTokens = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const seriesLabel = (name: string) => {
    switch (name) {
      case 'inputTokens':
        return t('usageDashboard.charts.inputTokens');
      case 'outputTokens':
        return t('usageDashboard.charts.outputTokens');
      case 'cacheReadTokens':
        return t('usageDashboard.table.cacheRead');
      case 'cacheWriteTokens':
        return t('usageDashboard.table.cacheWrite');
      default:
        return name;
    }
  };

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
        <h3 className="text-sm font-medium text-text-primary mb-4">{t('usageDashboard.charts.tokenUsageTrend')}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3d4166" />
            <XAxis dataKey="date" stroke="#8c8e95" fontSize={12} />
            <YAxis tickFormatter={formatTokens} stroke="#8c8e95" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid #2a2c3f',
                borderRadius: '6px',
                color: 'var(--color-text-primary)',
              }}
              wrapperClassName="text-xs"
              formatter={(value: number, name: string) => [formatTokens(value), seriesLabel(name)]}
            />
            <Legend formatter={(value) => <span className="mr-2 text-xs">{seriesLabel(value)}</span>} />
            <Area type="monotone" dataKey="inputTokens" stackId="tokens" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
            <Area type="monotone" dataKey="cacheReadTokens" stackId="tokens" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
            <Area type="monotone" dataKey="cacheWriteTokens" stackId="tokens" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
            <Area type="monotone" dataKey="outputTokens" stackId="tokens" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
