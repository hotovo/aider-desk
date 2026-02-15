import { useState, ReactNode, useRef, useEffect, RefObject } from 'react';
import { useDebounce } from '@reactuses/core';
import { useTranslation } from 'react-i18next';
import { FiEdit2, FiTrash2, FiPlus, FiEye, FiSliders, FiRefreshCw, FiChevronDown } from 'react-icons/fi';
import { Model, ProviderProfile } from '@aider-desk/common/types';
import { MdThermostat } from 'react-icons/md';

import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/common/Checkbox';
import { Column } from '@/components/common/Table';
import { VirtualTable } from '@/components/common/VirtualTable';
import { IconButton } from '@/components/common/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { type MenuOption } from '@/components/common/VerticalDotsMenu';

type Props = {
  models: Model[];
  selectedProviderIds: string[];
  providers: ProviderProfile[];
  onAddModel: () => void;
  onEditModel: (model: Model) => void;
  onDeleteModel: (model: Model) => void;
  onToggleHidden: (model: Model) => void;
  onBulkToggleHidden: (modelIds: string[], isHidden: boolean) => void;
  onRefreshModels: () => void;
  modelsLoading?: boolean;
};

const useClickOutside = (refs: React.RefObject<HTMLElement>[], callback: () => void) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (refs.every((ref) => ref.current && !ref.current.contains(event.target as Node))) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [refs, callback]);
};

export const ModelTableSection = ({
  models,
  selectedProviderIds,
  providers,
  onAddModel,
  onEditModel,
  onDeleteModel,
  onToggleHidden,
  onBulkToggleHidden,
  onRefreshModels,
  modelsLoading = false,
}: Props) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [tableKey, setTableKey] = useState(0);
  const bulkActionsRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 300);

  useClickOutside([bulkActionsRef as RefObject<HTMLElement>], () => {
    setIsBulkActionsOpen(false);
  });

  const filteredModels = models.filter((model) => {
    const matchesSearch = model.id.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesProvider = selectedProviderIds.length === 0 || selectedProviderIds.includes(model.providerId);
    const matchesHidden = showHidden || !model.isHidden;
    const provider = providers.find((p) => p.id === model.providerId);
    const matchesDisabled = provider && provider.disabled;
    return matchesSearch && matchesProvider && matchesHidden && !matchesDisabled;
  });

  const visibleModelIds = filteredModels.map((model) => model.id);

  const allVisibleSelected = visibleModelIds.length > 0 && visibleModelIds.every((id) => selectedModelIds.includes(id));

  const handleToggleSelectAll = () => {
    setTableKey(tableKey + 1);

    if (allVisibleSelected) {
      setSelectedModelIds([]);
    } else {
      setSelectedModelIds(visibleModelIds);
    }
  };

  const handleSelectModel = (modelId: string, checked: boolean) => {
    if (checked) {
      setSelectedModelIds((prev) => [...prev, modelId]);
    } else {
      setSelectedModelIds((prev) => prev.filter((id) => id !== modelId));
    }
  };

  const handleClearSelection = () => {
    setSelectedModelIds([]);
  };

  const handleBulkHide = () => {
    onBulkToggleHidden(selectedModelIds, true);
    setSelectedModelIds([]);
  };

  const handleBulkUnhide = () => {
    onBulkToggleHidden(selectedModelIds, false);
    setSelectedModelIds([]);
  };

  const bulkActionOptions: MenuOption[] = [
    {
      label: t('modelLibrary.hideSelected'),
      action: handleBulkHide,
    },
    {
      label: t('modelLibrary.unhideSelected'),
      action: handleBulkUnhide,
    },
    {
      label: t('modelLibrary.clearSelection'),
      action: handleClearSelection,
    },
  ];

  const getRowClassName = (row: Model) => {
    if (row.isHidden) {
      return 'text-text-muted-dark';
    }
    return undefined;
  };

  const columns: Column<Model>[] = [
    {
      header: <Checkbox checked={allVisibleSelected} onChange={handleToggleSelectAll} size="sm" />,
      cell: (_, row) => <Checkbox checked={selectedModelIds.includes(row.id)} onChange={(checked) => handleSelectModel(row.id, checked)} size="sm" />,
      cellClassName: 'text-xs',
      maxWidth: 40,
    },
    {
      accessor: 'id',
      header: t('modelLibrary.modelId'),
      cell: (value) => value as ReactNode,
      cellClassName: 'text-xs',
    },
    {
      accessor: 'providerId',
      header: t('modelLibrary.provider'),
      cell: (value) => {
        const provider = providers.find((p) => p.id === value);
        return provider ? provider.name || t(`providers.${provider.provider.name}`) : (value as ReactNode);
      },
      cellClassName: 'text-xs',
    },
    {
      accessor: 'maxInputTokens',
      header: t('modelLibrary.maxInputTokens'),
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.maxInputTokens || 0) - (b.maxInputTokens || 0),
    },
    {
      accessor: 'inputCostPerToken',
      header: t('modelLibrary.inputCost'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.inputCostPerToken || 0) - (b.inputCostPerToken || 0),
    },
    {
      accessor: 'cacheReadInputTokenCost',
      header: t('modelLibrary.cachedInput'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.cacheReadInputTokenCost || 0) - (b.cacheReadInputTokenCost || 0),
    },
    {
      accessor: 'cacheWriteInputTokenCost',
      header: t('modelLibrary.cacheWrites'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.cacheWriteInputTokenCost || 0) - (b.cacheWriteInputTokenCost || 0),
    },
    {
      accessor: 'outputCostPerToken',
      header: t('modelLibrary.outputCost'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.outputCostPerToken || 0) - (b.outputCostPerToken || 0),
    },
    {
      accessor: 'maxOutputTokens',
      header: t('modelLibrary.maxOutputTokens'),
      align: 'center',
      maxWidth: 180,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.maxOutputTokens || 0) - (b.maxOutputTokens || 0),
    },
    {
      accessor: 'temperature',
      header: (
        <Tooltip content={t('modelLibrary.temperature')}>
          <MdThermostat className="w-4 h-4 text-text-secondary" />
        </Tooltip>
      ),
      align: 'center',
      maxWidth: 50,
      cellClassName: 'text-xs',
      sort: (a, b) => {
        if (a.temperature === undefined && b.temperature === undefined) {
          return 0;
        }
        if (a.temperature === undefined) {
          return 1;
        }
        if (b.temperature === undefined) {
          return -1;
        }
        return (a.temperature || 0) - (b.temperature || 0);
      },
    },
    {
      header: '',
      cell: (_, row) => (
        <div className="flex items-center justify-end space-x-2">
          <IconButton icon={<FiEdit2 className="w-4 h-4" />} onClick={() => onEditModel(row)} />
          <IconButton
            icon={<FiEye className="w-4 h-4" />}
            onClick={() => onToggleHidden(row)}
            tooltip={row.isHidden ? t('modelLibrary.showModel') : t('modelLibrary.hideModel')}
          />
          {row.providerOverrides && Object.keys(row.providerOverrides).length > 0 && (
            <IconButton icon={<FiSliders className="w-4 h-4 text-text-secondary" />} tooltip={t('modelLibrary.overrides.overridesProviderParameters')} />
          )}
          {row.isCustom && (
            <IconButton icon={<FiTrash2 className="w-4 h-4" />} onClick={() => onDeleteModel(row)} className="text-error hover:text-error-light" />
          )}
        </div>
      ),
      align: 'left',
      maxWidth: 110,
    },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search and Info Header */}
      <div className="px-2 pt-2">
        <div className="flex items-center justify-between space-x-4 pr-4">
          <div className="flex items-center space-x-4 flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              wrapperClassName="min-w-[250px] flex-1 max-w-md"
              placeholder={t('modelLibrary.searchPlaceholder')}
            />
            <Checkbox label={t('modelLibrary.showHidden')} checked={showHidden} onChange={setShowHidden} size="sm" />
            <div className="text-2xs text-text-secondary pr-2 pl-4">
              {selectedProviderIds.length === 0
                ? t('modelLibrary.showingAllModels', { count: filteredModels.length })
                : t('modelLibrary.showingModelsFromProviders', {
                    modelCount: filteredModels.length,
                    providerCount: selectedProviderIds.length,
                  })}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {selectedModelIds.length > 0 && (
              <div className="flex items-center space-x-2" ref={bulkActionsRef}>
                <span className="text-2xs text-text-primary">{t('modelLibrary.selectedCount', { count: selectedModelIds.length })}</span>
                <div className="relative">
                  <button
                    onClick={() => setIsBulkActionsOpen(!isBulkActionsOpen)}
                    className="flex items-center gap-1 px-2 py-1 bg-bg-secondary text-text-tertiary hover:bg-bg-secondary-light hover:text-text-primary focus:outline-none transition-colors duration-200 text-xs border-border-default border rounded-md"
                  >
                    <span className="mb-[-2px] ml-1 text-2xs">{t('modelLibrary.bulkActions')}</span>
                    {isBulkActionsOpen ? <FiChevronDown className="w-3 h-3 ml-0.5 rotate-180" /> : <FiChevronDown className="w-3 h-3 ml-0.5" />}
                  </button>
                  {isBulkActionsOpen && (
                    <div className="absolute top-full right-0 mt-1 bg-bg-primary-light border border-border-default-dark rounded-md shadow-lg z-10 min-w-[150px]">
                      <ul>
                        {bulkActionOptions.map((option, index) => (
                          <li
                            key={index}
                            className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                            onClick={() => {
                              option.action();
                              setIsBulkActionsOpen(false);
                            }}
                          >
                            {option.icon && <span className="w-4 h-4 flex items-center justify-center">{option.icon}</span>}
                            <span className="whitespace-nowrap">{option.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            <Button onClick={onRefreshModels} size="sm" variant="text" disabled={modelsLoading}>
              <FiRefreshCw className={`w-4 h-4 mr-2 ${modelsLoading ? 'animate-spin' : ''}`} />
              {t('modelLibrary.refresh')}
            </Button>
            <Button onClick={onAddModel} size="sm" variant="text">
              <FiPlus className="w-4 h-4 mr-2" />
              {t('modelLibrary.addModel')}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-1 overflow-hidden mt-2">
        {filteredModels.length === 0 ? (
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-center">
              <p className="text-text-secondary text-sm">
                {search
                  ? t('modelLibrary.noModelsMatchSearch')
                  : selectedProviderIds.length === 0
                    ? t('modelLibrary.selectProvidersToViewModels')
                    : t('modelLibrary.noModelsFromSelectedProviders')}
              </p>
            </div>
          </div>
        ) : (
          <VirtualTable key={`${visibleModelIds.length}-${tableKey}`} data={filteredModels} columns={columns} getRowClassName={getRowClassName} />
        )}
      </div>
    </div>
  );
};
