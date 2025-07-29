import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UsageDataRow } from '@common/types';

import { generateColorPalette, formatDateByGroup, GroupBy } from './utils';

type MessageChartDataPoint = {
  date: string;
  [projectKey: string]: string | number; // Dynamic project keys for stacked data
};

type Props = {
  data: UsageDataRow[];
  groupBy: GroupBy;
};

export const MessageBreakdownChart = ({ data, groupBy }: Props) => {
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
      const currentCount = dateMap.get(projectDisplayName) || 0;
      dateMap.set(projectDisplayName, currentCount + 1); // Each row is one message
    });

    // Convert to array format for Recharts
    const processedData: MessageChartDataPoint[] = Array.from(aggregatedMap.entries())
      .map(([date, projectCounts]) => {
        const dataPoint: MessageChartDataPoint = { date };
        projectCounts.forEach((count, project) => {
          dataPoint[project] = count;
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
  }, [data]);

  const formatCount = (value: number) => {
    return value.toString();
  };

  // Limit legend items to prevent overcrowding
  const maxLegendItems = 10;
  const displayProjects = projectKeys.slice(0, maxLegendItems);
  const remainingCount = projectKeys.length - maxLegendItems;

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
        <h3 className="text-sm font-medium text-neutral-100 mb-4">{t('usageDashboard.charts.messageBreakdown')}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3d4166" />
            <XAxis dataKey="date" stroke="#8c8e95" fontSize={12} />
            <YAxis tickFormatter={formatCount} stroke="#8c8e95" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#222431',
                border: '1px solid #2a2c3f',
                borderRadius: '6px',
                color: '#f1f3f5',
              }}
              wrapperClassName="text-xs"
              formatter={(value: number, name: string) => [formatCount(value), name]}
              cursor={{ fill: '#999ba310' }}
            />
            <Legend
              formatter={(value) => (
                <span className="mr-2 text-xs">
                  {value}
                  {value === displayProjects[displayProjects.length - 1] && remainingCount > 0 && (
                    <span className="text-neutral-400 ml-1">(+{remainingCount} more)</span>
                  )}
                </span>
              )}
              wrapperStyle={{ fontSize: '12px' }}
            />
            {displayProjects.map((project) => (
              <Bar key={project} dataKey={project} stackId="messages" fill={projectColors.get(project)} />
            ))}
            {/* Render remaining projects without legend */}
            {projectKeys.slice(maxLegendItems).map((project) => (
              <Bar key={project} dataKey={project} stackId="messages" fill={projectColors.get(project)} legendType="none" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
