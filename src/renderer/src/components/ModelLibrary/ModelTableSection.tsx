import { useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FiEdit2, FiTrash2, FiPlus, FiEye } from 'react-icons/fi';
import { Model, ProviderProfile } from '@common/types';

import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Column, Table } from '@/components/common/Table';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  models: Model[];
  modelCount: number;
  selectedProviderIds: string[];
  providers: ProviderProfile[];
  onAddModel: () => void;
  onEditModel: (model: Model) => void;
  onDeleteModel: (model: Model) => void;
  onToggleHidden: (model: Model) => void;
};

export const ModelTableSection = ({ models, modelCount, selectedProviderIds, providers, onAddModel, onEditModel, onDeleteModel, onToggleHidden }: Props) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredModels = models.filter((model) => {
    const matchesSearch = model.id.toLowerCase().includes(search.toLowerCase());
    const matchesProvider = selectedProviderIds.length === 0 || selectedProviderIds.includes(model.providerId);
    return matchesSearch && matchesProvider;
  });

  const columns: Column<Model>[] = [
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
      maxWidth: 80,
    },
    {
      accessor: 'inputCostPerToken',
      header: t('modelLibrary.inputCost'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `$${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 80,
    },
    {
      accessor: 'cacheReadInputTokenCost',
      header: t('modelLibrary.cachedInput'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `$${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 80,
    },
    {
      accessor: 'cacheWriteInputTokenCost',
      header: t('modelLibrary.cacheWrites'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `$${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 80,
    },
    {
      accessor: 'outputCostPerToken',
      header: t('modelLibrary.outputCost'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `$${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 80,
    },
    {
      accessor: 'maxOutputTokens',
      header: t('modelLibrary.maxOutputTokens'),
      align: 'center',
      maxWidth: 80,
    },
    {
      header: '',
      cell: (_, row) => (
        <div className="flex items-center justify-end space-x-2">
          <IconButton icon={<FiEdit2 className="w-4 h-4" />} onClick={() => onEditModel(row)} />
          <IconButton
            icon={<FiEye className={`w-4 h-4 ${row.isHidden ? 'text-text-muted' : 'text-text-primary'}`} />}
            onClick={() => onToggleHidden(row)}
            tooltip={row.isHidden ? 'Show model' : 'Hide model'}
          />
          {row.isCustom && (
            <IconButton icon={<FiTrash2 className="w-4 h-4" />} onClick={() => onDeleteModel(row)} className="text-error hover:text-error-light" />
          )}
        </div>
      ),
      align: 'center',
      maxWidth: 80,
    },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search and Info Header */}
      <div className="px-2 pt-2">
        <div className="flex items-center justify-between space-x-4 pr-4">
          <div className="flex items-center space-x-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              wrapperClassName="min-w-[250px] flex-1 max-w-md"
              placeholder={t('modelLibrary.searchPlaceholder')}
            />
            <div className="text-2xs text-text-secondary pr-2">
              {selectedProviderIds.length === 0
                ? t('modelLibrary.showingAllModels', { count: modelCount })
                : t('modelLibrary.showingModelsFromProviders', {
                    modelCount: filteredModels.length,
                    providerCount: selectedProviderIds.length,
                  })}
            </div>
          </div>
          <Button onClick={onAddModel} size="sm" variant="text">
            <FiPlus className="w-4 h-4 mr-2" />
            {t('modelLibrary.addModel')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-1 overflow-hidden">
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
          <Table data={filteredModels} columns={columns} />
        )}
      </div>
    </div>
  );
};
