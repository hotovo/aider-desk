import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { UsageDataRow } from '@aider-desk/common/types';

import { generateColorPalette } from './utils';

type ModelDistributionDataPoint = {
  model: string;
  totalTokens: number;
  cost: number;
  percentage: number;
};

type Props = {
  data: UsageDataRow[];
};

export const ModelUsageDistributionChart = ({ data }: Props) => {
  const { t } = useTranslation();

  // Process data for pie chart (aggregate by model)
  const { chartData, modelColors } = useMemo(() => {
    const aggregatedMap = new Map<string, { totalTokens: number; cost: number }>();

    // First pass: aggregate data by model
    data.forEach((row) => {
      const model = row.model;
      const tokens = (row.input_tokens || 0) + (row.output_tokens || 0);
      const cost = row.cost || 0;

      if (!aggregatedMap.has(model)) {
        aggregatedMap.set(model, { totalTokens: 0, cost: 0 });
      }

      const existing = aggregatedMap.get(model)!;
      existing.totalTokens += tokens;
      existing.cost += cost;
    });

    // Calculate total tokens for percentage calculation
    const totalTokens = Array.from(aggregatedMap.values()).reduce((sum, item) => sum + item.totalTokens, 0);

    // Convert to array format for Recharts
    const processedData: ModelDistributionDataPoint[] = Array.from(aggregatedMap.entries())
      .map(([model, data]) => ({
        model,
        totalTokens: data.totalTokens,
        cost: data.cost,
        percentage: totalTokens > 0 ? (data.totalTokens / totalTokens) * 100 : 0,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens); // Sort by usage (descending)

    // Generate consistent colors for models
    const colors = generateColorPalette(processedData.length);
    const colorMap = new Map(processedData.map((item, index) => [item.model, colors[index]]));

    return {
      chartData: processedData,
      modelColors: colorMap,
    };
  }, [data]);

  const formatTokens = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const formatCurrency = (value: number) => {
    if (value >= 1) {
      return `$${value.toFixed(2)}`;
    }
    if (value >= 0.01) {
      return `$${value.toFixed(4)}`;
    }
    return `$${value.toFixed(6)}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
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
        <h3 className="text-sm font-medium text-text-primary mb-4">{t('usageDashboard.charts.modelUsageDistribution')}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={0} outerRadius={140} dataKey="totalTokens">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={modelColors.get(entry.model)} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => {
                const { active, payload } = props;
                if (active && payload && payload.length) {
                  const data = payload[0].payload as ModelDistributionDataPoint;
                  return (
                    <div className="bg-bg-secondary-light border border-border-default-dark rounded-md p-3 text-xs text-text-primary">
                      <div className="font-medium mb-2">{data.model}</div>
                      <div className="space-y-1">
                        <div>
                          {t('usageDashboard.charts.tokens')}: {formatTokens(data.totalTokens)}
                        </div>
                        <div>
                          {t('usageDashboard.charts.cost')}: {formatCurrency(data.cost)}
                        </div>
                        <div>
                          {t('usageDashboard.charts.share')}: {formatPercentage(data.percentage)}
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              content={(props) => {
                const { payload } = props;
                if (!payload) {
                  return null;
                }

                // Limit legend items to prevent overcrowding
                const maxItems = 8;
                const displayItems = payload.slice(0, maxItems);
                const remainingCount = payload.length - maxItems;

                return (
                  <div className="flex flex-wrap justify-center gap-2 mt-4 text-xs">
                    {displayItems.map((entry, index) => (
                      <div key={index} className="flex items-center space-x-1">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                        {/** @ts-expect-error: payload has model */}
                        <span className="text-text-tertiary">{entry.payload.model}</span>
                      </div>
                    ))}
                    {remainingCount > 0 && <div className="text-text-muted-light">{t('usageDashboard.charts.moreItems', { count: remainingCount })}</div>}
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
