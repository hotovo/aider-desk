import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UsageDataRow } from '@common/types';

type ChartDataPoint = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type Props = {
  data: UsageDataRow[];
};

export const TokenUsageTrendChart = ({ data }: Props) => {
  const { t } = useTranslation();

  // Process data for trend chart (aggregate by day)
  const chartData = useMemo(() => {
    const aggregatedMap = new Map<string, ChartDataPoint>();

    data.forEach((row) => {
      const date = new Date(row.timestamp).toISOString().split('T')[0]; // Get YYYY-MM-DD format

      if (aggregatedMap.has(date)) {
        const existing = aggregatedMap.get(date)!;
        aggregatedMap.set(date, {
          date,
          inputTokens: existing.inputTokens + (row.input_tokens || 0),
          outputTokens: existing.outputTokens + (row.output_tokens || 0),
          totalTokens: existing.totalTokens + (row.input_tokens || 0) + (row.output_tokens || 0),
        });
      } else {
        aggregatedMap.set(date, {
          date,
          inputTokens: row.input_tokens || 0,
          outputTokens: row.output_tokens || 0,
          totalTokens: (row.input_tokens || 0) + (row.output_tokens || 0),
        });
      }
    });

    return Array.from(aggregatedMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatTokens = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  if (chartData.length === 0) {
    return (
      <div className="flex-grow flex items-center justify-center text-neutral-400">
        <div className="text-center">
          <div className="text-lg mb-2">{t('usageDashboard.charts.noData')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow p-2">
      <div className="bg-neutral-900 border border-neutral-800 p-4">
        <h3 className="text-sm font-medium text-neutral-100 mb-4">{t('usageDashboard.charts.tokenUsageTrend')}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3d4166" />
            <XAxis dataKey="date" tickFormatter={formatDate} stroke="#8c8e95" fontSize={12} />
            <YAxis tickFormatter={formatTokens} stroke="#8c8e95" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#222431',
                border: '1px solid #2a2c3f',
                borderRadius: '6px',
                color: '#f1f3f5',
              }}
              labelFormatter={(label) => formatDate(label as string)}
              wrapperClassName="text-xs"
              formatter={(value: number, name: string) => [
                formatTokens(value),
                name === 'inputTokens'
                  ? t('usageDashboard.charts.inputTokens')
                  : name === 'outputTokens'
                    ? t('usageDashboard.charts.outputTokens')
                    : t('usageDashboard.table.totalTokens'),
              ]}
            />
            <Legend
              formatter={(value) => (
                <span className="mr-2 text-xs">
                  {value === 'inputTokens'
                    ? t('usageDashboard.charts.inputTokens')
                    : value === 'outputTokens'
                      ? t('usageDashboard.charts.outputTokens')
                      : t('usageDashboard.table.totalTokens')}
                </span>
              )}
            />
            <Line type="monotone" dataKey="inputTokens" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="outputTokens" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="totalTokens" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
