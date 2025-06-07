import { Theme } from '@common/types';
import { useTranslation } from 'react-i18next';

type Props = {
  theme: Theme;
  onClick?: () => void;
  isSelected?: boolean;
};

export const ThemePreview = ({ theme, onClick, isSelected = false }: Props) => {
  const { t } = useTranslation();
  
  // Create a mini preview with the theme's actual colors
  const previewStyle = {
    backgroundColor: theme.colors.background.primary,
    color: theme.colors.foreground.primary,
    borderColor: theme.colors.border.primary,
  };
  
  return (
    <div 
      className={`relative p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
        isSelected 
          ? 'ring-2 ring-offset-2 ring-offset-[var(--theme-background-primary)] ring-[var(--theme-accent-primary)]' 
          : 'hover:ring-1 hover:ring-[var(--theme-border-secondary)]'
      }`}
      style={previewStyle}
      onClick={onClick}
    >
      <div className="text-sm font-medium mb-2" style={{ color: theme.colors.foreground.primary }}>
        {theme.name}
      </div>
      
      {/* Mini UI preview */}
      <div className="space-y-2">
        {/* Background colors preview */}
        <div>
          <div className="text-xs mb-1" style={{ color: theme.colors.foreground.secondary }}>
            {t('themeEditor.colorCategories.background')}
          </div>
          <div className="flex space-x-1">
            {Object.values(theme.colors.background).map((color, index) => (
              <div 
                key={`bg-${index}`} 
                className="w-4 h-4 rounded border" 
                style={{ 
                  backgroundColor: color,
                  borderColor: theme.colors.border.primary
                }}
                title={Object.keys(theme.colors.background)[index]}
              />
            ))}
          </div>
        </div>
        
        {/* Accent colors preview */}
        <div>
          <div className="text-xs mb-1" style={{ color: theme.colors.foreground.secondary }}>
            {t('themeEditor.colorCategories.accent')}
          </div>
          <div className="flex space-x-1">
            {Object.values(theme.colors.accent).map((color, index) => (
              <div 
                key={`accent-${index}`} 
                className="w-4 h-4 rounded border" 
                style={{ 
                  backgroundColor: color,
                  borderColor: theme.colors.border.primary
                }}
                title={Object.keys(theme.colors.accent)[index]}
              />
            ))}
          </div>
        </div>
        
        {/* Button preview */}
        <div className="flex space-x-1">
          <div 
            className="px-2 py-1 text-xs rounded"
            style={{
              backgroundColor: theme.colors.button.primary,
              color: theme.colors.foreground.primary
            }}
          >
            Primary
          </div>
          <div 
            className="px-2 py-1 text-xs rounded border"
            style={{
              backgroundColor: 'transparent',
              color: theme.colors.button.primary,
              borderColor: theme.colors.button.primary
            }}
          >
            Outline
          </div>
        </div>
      </div>
      
      <div 
        className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded"
        style={{
          backgroundColor: theme.colors.background.tertiary,
          color: theme.colors.foreground.secondary
        }}
      >
        {theme.type}
      </div>
    </div>
  );
};