import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UsageDataRow, Model } from '@common/types';
import { getProviderModelId } from '@common/agent';

import { formatDateByGroup, GroupBy } from './utils';

import { useModelProviders } from '@/contexts/ModelProviderContext';

type ChartDataPoint = {
  date: string;
  paid: number;
  savings: number;
};

type Props = {
  data: UsageDataRow[];
  groupBy: GroupBy;
};

const getCacheReadCostBreakdown = (model: Model | undefined): { paidPerToken: number; savingsPerToken: number } => {
  const inputCostPerToken = model?.inputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model?.cacheReadInputTokenCost ?? inputCostPerToken;

  return {
    paidPerToken: cacheReadInputTokenCost,
    savingsPerToken: Math.max(inputCostPerToken - cacheReadInputTokenCost, 0),
  };
};

export const CacheSavingsChart = ({ data, groupBy }: Props) => {
  const { t } = useTranslation();
  const { models } = useModelProviders();

  const modelsById = useMemo(() => new Map(models.map((model) => [getProviderModelId(model), model])), [models]);

  const chartData = useMemo(() => {
    const aggregatedMap = new Map<string, ChartDataPoint>();

    data.forEach((row) => {
      const date = formatDateByGroup(row.timestamp, groupBy);
      const cacheReadTokens = row.cache_read_tokens || 0;
      const { paidPerToken, savingsPerToken } = getCacheReadCostBreakdown(modelsById.get(row.model));

      const existing = aggregatedMap.get(date) || { date, paid: 0, savings: 0 };
      aggregatedMap.set(date, {
        date,
        paid: existing.paid + cacheReadTokens * paidPerToken,
        savings: existing.savings + cacheReadTokens * savingsPerToken,
      });
    });

    return Array.from(aggregatedMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, groupBy, modelsById]);

  const totals = useMemo(
    () =>
      chartData.reduce(
        (acc, point) => ({
          paid: acc.paid + point.paid,
          savings: acc.savings + point.savings,
        }),
        { paid: 0, savings: 0 },
      ),
    [chartData],
  );

  const formatCurrency = (value: number) => {
    if (value >= 1) {
      return `$${value.toFixed(2)}`;
    }
    if (value >= 0.01) {
      return `$${value.toFixed(4)}`;
    }
    return `$${value.toFixed(6)}`;
  };

  const seriesLabel = (name: string) => (name === 'paid' ? t('usageDashboard.charts.cost') : t('usageDashboard.charts.cacheSavings'));

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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-primary">{t('usageDashboard.charts.cacheSavingsTrend')}</h3>
          <div className="flex items-center space-x-3 text-xs text-text-muted-light">
            <span>{t('usageDashboard.charts.totalPaid', { amount: formatCurrency(totals.paid) })}</span>
            <span>{t('usageDashboard.charts.totalSaved', { amount: formatCurrency(totals.savings) })}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3d4166" />
            <XAxis dataKey="date" stroke="#8c8e95" fontSize={12} />
            <YAxis tickFormatter={formatCurrency} stroke="#8c8e95" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid #2a2c3f',
                borderRadius: '6px',
                color: 'var(--color-text-primary)',
              }}
              wrapperClassName="text-xs"
              formatter={(value: number, name: string) => [formatCurrency(value), seriesLabel(name)]}
              cursor={{ fill: '#999ba310' }}
            />
            <Legend formatter={(value) => <span className="mr-2 text-xs">{seriesLabel(value)}</span>} />
            <Bar dataKey="paid" stackId="cacheCost" fill="#f59e0b" />
            <Bar dataKey="savings" stackId="cacheCost" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
