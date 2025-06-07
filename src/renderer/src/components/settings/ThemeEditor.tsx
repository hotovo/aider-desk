import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Theme } from '@common/types';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/context/ThemeContext';

import { Button } from '../common/Button';
import { Accordion } from '../common/Accordion';
import { Input } from '../common/Input';
import { Select, Option } from '../common/Select';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type ColorInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const ColorInput = ({ label, value, onChange }: ColorInputProps) => {
  return (
    <div className="flex items-center mb-2">
      <span className="w-32 text-sm">{label}</span>
      <div className="flex items-center">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 mr-2 rounded border border-neutral-700 cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 text-xs"
        />
      </div>
    </div>
  );
};

type ColorCategoryProps = {
  title: string;
  colors: Record<string, string>;
  onChange: (category: string, name: string, value: string) => void;
  categoryKey: string;
};

const ColorCategory = ({ title, colors, onChange, categoryKey }: ColorCategoryProps) => {
  const { t } = useTranslation();
  
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <div className="pl-4">
        {Object.entries(colors).map(([name, value]) => (
          <ColorInput
            key={`${categoryKey}-${name}`}
            label={t(`themeEditor.colors.${categoryKey}.${name}`)}
            value={value}
            onChange={(newValue) => onChange(categoryKey, name, newValue)}
          />
        ))}
      </div>
    </div>
  );
};

type Props = {
  onClose: () => void;
};

export const ThemeEditor = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const { themes, saveThemes, setCurrentThemeById } = useTheme();
  
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [editedTheme, setEditedTheme] = useState<Theme | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>('general');
  
  const themeOptions: Option[] = themes.map((theme) => ({
    label: theme.name,
    value: theme.id,
  }));
  
  useEffect(() => {
    if (themes.length > 0 && !selectedThemeId) {
      setSelectedThemeId(themes[0].id);
      setEditedTheme(JSON.parse(JSON.stringify(themes[0])));
    }
  }, [themes, selectedThemeId]);
  
  const handleThemeChange = (themeId: string) => {
    // Only change the theme in the editor if it's not being edited
    // or if user explicitly selects a different theme
    if (!isEditing || selectedThemeId !== themeId) {
      setCurrentThemeById(themeId);
    }
    
    setSelectedThemeId(themeId);
    const theme = themes.find((t) => t.id === themeId);
    if (theme) {
      setEditedTheme(JSON.parse(JSON.stringify(theme)));
      setIsEditing(false);
    }
  };
  
  const handleColorChange = (category: string, name: string, value: string) => {
    if (!editedTheme) return;
    
    setEditedTheme({
      ...editedTheme,
      colors: {
        ...editedTheme.colors,
        [category]: {
          ...editedTheme.colors[category],
          [name]: value,
        },
      },
    });
    
    setIsEditing(true);
  };
  
  const handleNameChange = (name: string) => {
    if (!editedTheme) return;
    
    setEditedTheme({
      ...editedTheme,
      name,
    });
    
    setIsEditing(true);
  };
  
  const handleTypeChange = (type: string) => {
    if (!editedTheme) return;
    
    setEditedTheme({
      ...editedTheme,
      type: type as 'dark' | 'light',
    });
    
    setIsEditing(true);
  };
  
  const handleSave = async () => {
    if (!editedTheme) return;
    
    const updatedThemes = [...themes];
    const index = updatedThemes.findIndex((t) => t.id === editedTheme.id);
    
    if (index !== -1) {
      updatedThemes[index] = editedTheme;
    }
    
    await saveThemes(updatedThemes);
    
    // Apply the theme after saving
    setCurrentThemeById(editedTheme.id);
    setIsEditing(false);
  };
  
  const handleDuplicate = async () => {
    if (!editedTheme) return;
    
    const newTheme: Theme = {
      ...JSON.parse(JSON.stringify(editedTheme)),
      id: uuidv4(),
      name: `${editedTheme.name} (Copy)`,
    };
    
    const updatedThemes = [...themes, newTheme];
    await saveThemes(updatedThemes);
    
    setSelectedThemeId(newTheme.id);
    setEditedTheme(newTheme);
  };
  
  const handleDelete = async () => {
    if (!editedTheme) return;
    
    // Don't allow deleting if there's only one theme left
    if (themes.length <= 1) {
      return;
    }
    
    const updatedThemes = themes.filter((t) => t.id !== editedTheme.id);
    await saveThemes(updatedThemes);
    
    setSelectedThemeId(updatedThemes[0].id);
    setEditedTheme(JSON.parse(JSON.stringify(updatedThemes[0])));
    setShowDeleteConfirm(false);
  };
  
  const handleCreateNew = async () => {
    const newTheme: Theme = {
      id: uuidv4(),
      name: t('themeEditor.newThemeName'),
      type: 'dark',
      colors: {
        background: {
          primary: '#191a22',
          secondary: '#222431',
          tertiary: '#2a2c3f',
          input: '#333652',
        },
        foreground: {
          primary: '#f1f3f5',
          secondary: '#adb5bd',
          tertiary: '#6c757d',
          error: '#e16b6b',
        },
        border: {
          primary: '#3d4166',
          secondary: '#585c75',
        },
        accent: {
          primary: '#4a6bff',
          secondary: '#3d5ce0',
          tertiary: '#2e4cc0',
        },
        button: {
          primary: '#4a6bff',
          secondary: '#585c75',
          danger: '#e16b6b',
        },
      },
    };
    
    const updatedThemes = [...themes, newTheme];
    await saveThemes(updatedThemes);
    
    setSelectedThemeId(newTheme.id);
    setEditedTheme(newTheme);
    setIsEditing(true);
  };
  
  if (!editedTheme) {
    return null;
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <Select
            options={themeOptions}
            value={selectedThemeId}
            onChange={handleThemeChange}
            className="w-64"
          />
          <Button
            variant="outline"
            color="primary"
            onClick={handleCreateNew}
            className="ml-2"
          >
            {t('themeEditor.createNew')}
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            color="primary"
            onClick={handleDuplicate}
          >
            {t('themeEditor.duplicate')}
          </Button>
          <Button
            variant="outline"
            color="danger"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={themes.length <= 1}
          >
            {t('themeEditor.delete')}
          </Button>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto pr-4">
        <Accordion
          title={<div className="flex-1 text-left text-sm font-medium px-2">{t('themeEditor.general')}</div>}
          chevronPosition="right"
          className="mb-2 border rounded-md"
          style={{ borderColor: 'var(--theme-border-primary)' }}
          isOpen={openAccordion === 'general'}
          onOpenChange={(isOpen) => setOpenAccordion(isOpen ? 'general' : null)}
        >
          <div className="p-4 pt-2 space-y-4">
            <div className="flex items-center">
              <span className="w-32 text-sm">{t('themeEditor.name')}</span>
              <Input
                value={editedTheme.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="flex items-center">
              <span className="w-32 text-sm">{t('themeEditor.type')}</span>
              <Select
                options={[
                  { label: t('themeEditor.dark'), value: 'dark' },
                  { label: t('themeEditor.light'), value: 'light' },
                ]}
                value={editedTheme.type}
                onChange={handleTypeChange}
                className="w-64"
              />
            </div>
          </div>
        </Accordion>
        
        <Accordion
          title={<div className="flex-1 text-left text-sm font-medium px-2">{t('themeEditor.colorCategories.background')}</div>}
          chevronPosition="right"
          className="mb-2 border rounded-md"
          style={{ borderColor: 'var(--theme-border-primary)' }}
          isOpen={openAccordion === 'background'}
          onOpenChange={(isOpen) => setOpenAccordion(isOpen ? 'background' : null)}
        >
          <div className="p-4 pt-2">
            <ColorCategory
              title={t('themeEditor.colorCategories.background')}
              colors={editedTheme.colors.background}
              onChange={handleColorChange}
              categoryKey="background"
            />
          </div>
        </Accordion>

        <Accordion
          title={<div className="flex-1 text-left text-sm font-medium px-2">{t('themeEditor.colorCategories.foreground')}</div>}
          chevronPosition="right"
          className="mb-2 border rounded-md"
          style={{ borderColor: 'var(--theme-border-primary)' }}
          isOpen={openAccordion === 'foreground'}
          onOpenChange={(isOpen) => setOpenAccordion(isOpen ? 'foreground' : null)}
        >
          <div className="p-4 pt-2">
            <ColorCategory
              title={t('themeEditor.colorCategories.foreground')}
              colors={editedTheme.colors.foreground}
              onChange={handleColorChange}
              categoryKey="foreground"
            />
          </div>
        </Accordion>

        <Accordion
          title={<div className="flex-1 text-left text-sm font-medium px-2">{t('themeEditor.colorCategories.border')}</div>}
          chevronPosition="right"
          className="mb-2 border rounded-md"
          style={{ borderColor: 'var(--theme-border-primary)' }}
          isOpen={openAccordion === 'border'}
          onOpenChange={(isOpen) => setOpenAccordion(isOpen ? 'border' : null)}
        >
          <div className="p-4 pt-2">
            <ColorCategory
              title={t('themeEditor.colorCategories.border')}
              colors={editedTheme.colors.border}
              onChange={handleColorChange}
              categoryKey="border"
            />
          </div>
        </Accordion>

        <Accordion
          title={<div className="flex-1 text-left text-sm font-medium px-2">{t('themeEditor.colorCategories.accent')}</div>}
          chevronPosition="right"
          className="mb-2 border rounded-md"
          style={{ borderColor: 'var(--theme-border-primary)' }}
          isOpen={openAccordion === 'accent'}
          onOpenChange={(isOpen) => setOpenAccordion(isOpen ? 'accent' : null)}
        >
          <div className="p-4 pt-2">
            <ColorCategory
              title={t('themeEditor.colorCategories.accent')}
              colors={editedTheme.colors.accent}
              onChange={handleColorChange}
              categoryKey="accent"
            />
          </div>
        </Accordion>

        <Accordion
          title={<div className="flex-1 text-left text-sm font-medium px-2">{t('themeEditor.colorCategories.button')}</div>}
          chevronPosition="right"
          className="mb-2 border rounded-md"
          style={{ borderColor: 'var(--theme-border-primary)' }}
          isOpen={openAccordion === 'button'}
          onOpenChange={(isOpen) => setOpenAccordion(isOpen ? 'button' : null)}
        >
          <div className="p-4 pt-2">
            <ColorCategory
              title={t('themeEditor.colorCategories.button')}
              colors={editedTheme.colors.button}
              onChange={handleColorChange}
              categoryKey="button"
            />
          </div>
        </Accordion>
      </div>
      
      <div className="flex justify-end space-x-2 mt-4">
        <Button variant="text" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={!isEditing}
        >
          {t('common.save')}
        </Button>
      </div>
      
      {showDeleteConfirm && (
        <ConfirmDialog
          title={t('themeEditor.deleteConfirm.title')}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmButtonText={t('common.delete')}
          cancelButtonText={t('common.cancel')}
          width={400}
        >
          <p>{t('themeEditor.deleteConfirm.message', { name: editedTheme.name })}</p>
        </ConfirmDialog>
      )}
    </div>
  );
};