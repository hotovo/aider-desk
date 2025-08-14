import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UsageDataRow } from '@common/types';

import { generateColorPalette, formatDateByGroup, GroupBy } from './utils';

type CostChartDataPoint = {
  date: string;
  [projectKey: string]: string | number; // Dynamic project keys for stacked data
};

type Props = {
  data: UsageDataRow[];
  groupBy: GroupBy;
};

export const CostBreakdownChart = ({ data, groupBy }: Props) => {
  const { t } = useTranslation();

  // Process data for stacked bar chart (aggregate by day and project)
  const { chartData, projectKeys, projectColors } = useMemo(() => {
    const aggregatedMap = new Map<string, Map<string, number>>();
    const projectSet = new Set<string>();

    // First pass: collect all projects and aggregate data
    data.forEach((row) => {
      const date = formatDateByGroup(row.timestamp, groupBy);
      const projectDisplayName = row.project.split('/').pop() || row.project;

      projectSet.add(projectDisplayName);

      if (!aggregatedMap.has(date)) {
        aggregatedMap.set(date, new Map());
      }

      const dateMap = aggregatedMap.get(date)!;
      const currentCost = dateMap.get(projectDisplayName) || 0;
      dateMap.set(projectDisplayName, currentCost + (row.cost || 0));
    });

    // Convert to array format for Recharts
    const processedData: CostChartDataPoint[] = Array.from(aggregatedMap.entries())
      .map(([date, projectCosts]) => {
        const dataPoint: CostChartDataPoint = { date };
        projectCosts.forEach((cost, project) => {
          dataPoint[project] = cost;
        });
        return dataPoint;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Generate consistent colors for projects
    const projects = Array.from(projectSet).sort(); // Sort for consistency
    const colors = generateColorPalette(projects.length);
    const colorMap = new Map(projects.map((project, index) => [project, colors[index]]));

    return {
      chartData: processedData,
      projectKeys: projects,
      projectColors: colorMap,
    };
  }, [data, groupBy]);

  const formatCurrency = (value: number) => {
    if (value >= 1) {
      return `$${value.toFixed(2)}`;
    }
    if (value >= 0.01) {
      return `$${value.toFixed(4)}`;
    }
    return `$${value.toFixed(6)}`;
  };

  // Limit legend items to prevent overcrowding
  const maxLegendItems = 10;
  const displayProjects = projectKeys.slice(0, maxLegendItems);
  const remainingCount = projectKeys.length - maxLegendItems;

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
        <h3 className="text-sm font-medium text-text-primary mb-4">{t('usageDashboard.charts.costBreakdown')}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 20, bottom: 0 }}>
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
              formatter={(value: number, name: string) => [formatCurrency(value), name]}
              cursor={{ fill: '#999ba310' }}
            />
            <Legend
              formatter={(value) => (
                <span className="mr-2 text-xs">
                  {value}
                  {value === displayProjects[displayProjects.length - 1] && remainingCount > 0 && (
                    <span className="text-text-muted-light ml-1">(+{remainingCount} more)</span>
                  )}
                </span>
              )}
              wrapperStyle={{ fontSize: '12px' }}
            />
            {displayProjects.map((project) => (
              <Bar key={project} dataKey={project} stackId="cost" fill={projectColors.get(project)} />
            ))}
            {/* Render remaining projects without legend */}
            {projectKeys.slice(maxLegendItems).map((project) => (
              <Bar key={project} dataKey={project} stackId="cost" fill={projectColors.get(project)} legendType="none" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
