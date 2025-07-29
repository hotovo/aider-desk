import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSync, FaTable, FaChartBar } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import { CgSpinner } from 'react-icons/cg';
import { UsageDataRow } from '@common/types';
import clsx from 'clsx';

import { Select } from '../common/Select';

import { UsageTable } from './UsageTable';
import { TokenUsageTrendChart } from './TokenUsageTrendChart';
import { DailyCostBreakdownChart } from './DailyCostBreakdownChart';
import { DailyMessageBreakdownChart } from './DailyMessageBreakdownChart';
import { ModelUsageDistributionChart } from './ModelUsageDistributionChart';

import { DatePicker } from '@/components/common/DatePicker';
import { MultiSelect } from '@/components/common/MultiSelect';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  onClose: () => void;
};

enum DatePeriod {
  All = 'all',
  ThisMonth = 'thisMonth',
  Today = 'today',
  Custom = 'custom',
}

enum DatePeriodGroup {
  Year = 'year',
  Month = 'month',
  Day = 'day',
  Hour = 'hour',
}

enum ViewTab {
  Table = 'table',
  Charts = 'charts',
}

export const UsageDashboard = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const [data, setData] = useState<UsageDataRow[]>([]);
  const [filteredData, setFilteredData] = useState<UsageDataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>(DatePeriod.ThisMonth);
  const [selectedPeriodGroup, setSelectedPeriodGroup] = useState<DatePeriodGroup>(DatePeriodGroup.Month);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return [startOfMonth, now];
  });
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>(ViewTab.Table);

  const projectOptions = useMemo(() => {
    const projects = [...new Set(data.map((row) => row.project))];
    return projects.map((p) => ({ value: p, label: p.split('/').pop() || p }));
  }, [data]);

  const modelOptions = useMemo(() => {
    const models = [...new Set(data.map((row) => row.model))];
    return models.map((m) => ({ value: m, label: m }));
  }, [data]);

  const handlePeriodChange = (period: DatePeriod) => {
    setSelectedPeriod(period);

    const now = new Date();
    let startDate: Date;
    const endDate: Date = now;

    if (period === DatePeriod.Today) {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === DatePeriod.ThisMonth) {
      // This month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    setDateRange([startDate, endDate]);
  };

  const handleDateRangeChange = (update: [Date | null, Date | null]) => {
    setDateRange(update);

    setSelectedPeriod(DatePeriod.Custom);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [from, to] = dateRange;
      if (from && to) {
        const result = await window.api.queryUsageData(from.toISOString(), to.toISOString());
        setData(result);
      }
    } catch {
      setError(t('usageDashboard.error.fetch'));
    } finally {
      setLoading(false);
    }
  }, [dateRange, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    let result = data;
    // Treat empty selections as "all selected"
    if (projectFilter.length > 0) {
      result = result.filter((row) => projectFilter.includes(row.project));
    }
    if (modelFilter.length > 0) {
      result = result.filter((row) => modelFilter.includes(row.model));
    }
    setFilteredData(result);
  }, [data, projectFilter, modelFilter]);

  const handleRefresh = () => {
    void fetchData();
  };

  return (
    <div className="absolute inset-0 bg-neutral-900 z-50 flex flex-col">
      <div className="flex items-center border-b-2 border-neutral-600 justify-between bg-gradient-to-b from-neutral-950 to-neutral-900 min-h-[40px] pl-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-md uppercase font-medium text-neutral-100">{t('usageDashboard.title')}</h2>
        </div>
        <IconButton
          icon={<IoMdClose className="h-5 w-5 text-neutral-200" />}
          onClick={onClose}
          tooltip={t('common.close')}
          className="px-4 py-2 hover:text-neutral-200 hover:bg-neutral-700/30 transition-colors duration-200"
        />
      </div>

      <div className="flex items-center space-x-4 p-4 border-b-2 border-neutral-800">
        <div className="flex items-end space-x-2">
          <DatePicker
            label={t('usageDashboard.dateRange')}
            className="min-w-[250px]"
            selectsRange
            startDate={dateRange[0]}
            endDate={dateRange[1]}
            onChange={handleDateRangeChange}
          />
          <div className="flex bg-neutral-800 rounded-md p-1">
            {[
              { value: DatePeriod.Today, label: t('usageDashboard.today') },
              { value: DatePeriod.ThisMonth, label: t('usageDashboard.thisMonth') },
              { value: DatePeriod.All, label: t('usageDashboard.all') },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => handlePeriodChange(period.value)}
                className={clsx(
                  'px-3 py-1 text-sm rounded transition-colors duration-200',
                  selectedPeriod === period.value ? 'bg-neutral-600 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700',
                )}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end space-x-2">
          <Select
            options={[
              { value: DatePeriodGroup.Hour, label: t('usageDashboard.hour') },
              { value: DatePeriodGroup.Day, label: t('usageDashboard.day') },
              { value: DatePeriodGroup.Month, label: t('usageDashboard.month') },
              { value: DatePeriodGroup.Year, label: t('usageDashboard.year') },
            ]}
            value={selectedPeriodGroup}
            onChange={(value) => setSelectedPeriodGroup(value as DatePeriodGroup)}
            label={t('usageDashboard.groupBy')}
            className="min-w-[120px]"
          />
          <MultiSelect
            options={projectOptions}
            selected={projectFilter}
            onChange={setProjectFilter}
            label={t('usageDashboard.projects')}
            className="min-w-[250px]"
            noneSelectedLabel={t('usageDashboard.all')}
          />
          <MultiSelect
            options={modelOptions}
            selected={modelFilter}
            onChange={setModelFilter}
            label={t('usageDashboard.models')}
            className="min-w-[250px]"
            noneSelectedLabel={t('usageDashboard.all')}
          />
          <IconButton
            icon={<FaSync className={loading ? 'animate-spin' : ''} />}
            onClick={handleRefresh}
            disabled={loading}
            tooltip={loading ? t('common.loading') : t('usageDashboard.refresh')}
            className="p-2 hover:bg-neutral-800 rounded-md mb-1"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center border-b-2 border-neutral-800 bg-neutral-900">
        <div className="flex bg-neutral-800 rounded-md p-1 m-4">
          <button
            onClick={() => setActiveTab(ViewTab.Table)}
            className={clsx(
              'px-4 py-2 text-sm rounded transition-colors duration-200 flex items-center space-x-2',
              activeTab === ViewTab.Table ? 'bg-neutral-600 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700',
            )}
          >
            <FaTable className="w-4 h-4" />
            <span>{t('usageDashboard.tabs.table')}</span>
          </button>
          <button
            onClick={() => setActiveTab(ViewTab.Charts)}
            className={clsx(
              'px-4 py-2 text-sm rounded transition-colors duration-200 flex items-center space-x-2',
              activeTab === ViewTab.Charts ? 'bg-neutral-600 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700',
            )}
          >
            <FaChartBar className="w-4 h-4" />
            <span>{t('usageDashboard.tabs.charts')}</span>
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 mx-4">{error}</div>}

      {loading ? (
        <div className="flex-grow flex items-center justify-center">
          <CgSpinner className="animate-spin w-10 h-10 text-neutral-100" />
        </div>
      ) : (
        <>
          {activeTab === ViewTab.Table && <UsageTable data={filteredData} />}
          {activeTab === ViewTab.Charts && (
            <div className="flex-grow p-2 overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-700">
              <div className="grid grid-cols-1 xl:grid-cols-2">
                <TokenUsageTrendChart data={filteredData} />
                <ModelUsageDistributionChart data={filteredData} />
                <DailyCostBreakdownChart data={filteredData} />
                <DailyMessageBreakdownChart data={filteredData} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
