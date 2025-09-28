import { useTranslation } from 'react-i18next';
import { FiPlus } from 'react-icons/fi';
import { ProviderProfile } from '@common/types';

import { ProviderProfileCard } from './ProviderProfileCard';

import { Button } from '@/components/common/Button';

type Props = {
  providers: ProviderProfile[];
  providerErrors: Record<string, string>;
  selectedProfileIds: string[];
  onToggleSelect: (profileId: string) => void;
  onAddProvider: () => void;
  onEditProfile: (profile: ProviderProfile) => void;
  onDeleteProfile: (profile: ProviderProfile) => void;
};

export const ProviderHeader = ({ providers, providerErrors, selectedProfileIds, onToggleSelect, onAddProvider, onEditProfile, onDeleteProfile }: Props) => {
  const { t } = useTranslation();

  if (providers.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <p className="mb-4">{t('modelLibrary.noProvidersConfigured')}</p>
            <Button onClick={onAddProvider} variant="text" size="sm">
              <FiPlus className="w-4 h-4 mr-2" /> {t('modelLibrary.addFirstProvider')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-3 items-start">
        {providers.map((profile) => (
          <div key={profile.id} className="flex-shrink-0 min-w-0 max-w-xs">
            <ProviderProfileCard
              provider={profile}
              error={providerErrors[profile.id]}
              isSelected={selectedProfileIds.includes(profile.id)}
              onToggleSelect={() => onToggleSelect(profile.id)}
              onEdit={() => onEditProfile(profile)}
              onDelete={() => onDeleteProfile(profile)}
            />
          </div>
        ))}
        <div className="flex-shrink-0">
          <Button
            onClick={onAddProvider}
            size="xs"
            className="h-[72px] px-4 border-2 border-dashed border-border-dark-light hover:border-accent hover:bg-bg-secondary bg-transparent text-text-secondary hover:text-text-primary rounded-lg flex items-center gap-2 transition-all"
          >
            <FiPlus className="w-4 h-4" />
            {t('modelLibrary.addProvider')}
          </Button>
        </div>
      </div>
    </div>
  );
};
