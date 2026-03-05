import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailableExtension, LoadedExtension, SettingsData } from '@common/types';
import { AIDER_DESK_EXTENSIONS_REPO_URL } from '@common/extensions';

import { ExtensionsSettings } from '../ExtensionsSettings';

import { useApi } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

// Type definitions for mocked components
interface MotionDivProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

interface AnimatePresenceProps {
  children?: React.ReactNode;
}

interface AccordionProps {
  title?: string;
  children?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: () => void;
}

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  [key: string]: unknown;
}

interface IconButtonProps {
  icon?: React.ReactNode;
  onClick?: () => void;
  tooltip?: string;
}

interface InputProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  wrapperClassName?: string;
}

interface CheckboxProps {
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: React.ReactNode;
}

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      // Handle translation keys with parameters
      if (params?.name) {
        return `${key}.${params.name}`;
      }
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Mock notifications
vi.mock('@/utils/notifications', () => ({
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
}));

// Mock framer-motion to avoid animation delays
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: { div: ({ children, ...props }: MotionDivProps) => <div {...props}>{children}</div> },
    AnimatePresence: ({ children }: AnimatePresenceProps) => <>{children}</>,
  };
});

// Mock contexts
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

// Mock Accordion to simplify testing (controlled mode)
vi.mock('@/components/common/Accordion', () => ({
  Accordion: ({ title, children, isOpen, onOpenChange }: AccordionProps) => (
    <div data-testid="accordion">
      <div onClick={onOpenChange} data-testid="accordion-toggle" role="button" aria-expanded={isOpen} tabIndex={0}>
        {title}
      </div>
      {isOpen && <div data-testid="accordion-content">{children}</div>}
    </div>
  ),
}));

// Mock other components
vi.mock('@/components/common/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: ButtonProps) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/common/IconButton', () => ({
  IconButton: ({ icon, onClick, tooltip }: IconButtonProps) => (
    <button onClick={onClick} title={tooltip} data-testid="icon-button">
      {icon}
    </button>
  ),
}));

vi.mock('@/components/common/Input', () => ({
  Input: ({ value, onChange, placeholder, onKeyDown, wrapperClassName }: InputProps) => (
    <input value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown} className={wrapperClassName} data-testid="repository-url-input" />
  ),
}));

vi.mock('@/components/common/Checkbox', () => ({
  Checkbox: ({ checked, onChange, label }: CheckboxProps) => (
    <label>
      <input type="checkbox" checked={checked} onChange={onChange} data-testid="checkbox" />
      {label}
    </label>
  ),
}));

// Test data factories
const createMockAvailableExtension = (overrides: Partial<AvailableExtension> = {}): AvailableExtension => ({
  id: 'test-extension',
  name: 'Test Extension',
  version: '1.0.0',
  description: 'A test extension',
  author: 'Test Author',
  type: 'single',
  repositoryUrl: AIDER_DESK_EXTENSIONS_REPO_URL,
  hasDependencies: false,
  ...overrides,
});

const createMockLoadedExtension = (overrides: Partial<LoadedExtension> = {}): LoadedExtension => ({
  id: 'test-extension',
  metadata: {
    name: 'Test Extension',
    version: '1.0.0',
    description: 'A test extension',
    author: 'Test Author',
  },
  filePath: '/mock/path/to/extension.js',
  initialized: true,
  ...overrides,
});

describe('ExtensionsSettings', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let mockSettings: SettingsData;
  let mockSetSettings: (settings: SettingsData) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = createMockApi();
    mockSettings = {
      extensions: {
        repositories: [AIDER_DESK_EXTENSIONS_REPO_URL],
        disabled: [],
      },
    } as unknown as SettingsData;
    mockSetSettings = vi.fn();

    vi.mocked(useApi).mockReturnValue(mockApi);
  });

  describe('Repository Accordion Expansion State Preservation', () => {
    it('should preserve expanded state when installing an extension triggers re-render', async () => {
      // Setup: Create extensions from two different repositories
      const defaultRepoExtension = createMockAvailableExtension({
        id: 'default-repo-ext',
        name: 'Default Repo Extension',
        repositoryUrl: AIDER_DESK_EXTENSIONS_REPO_URL,
      });

      const customRepoUrl = 'https://github.com/custom/extensions';
      const customRepoExtension = createMockAvailableExtension({
        id: 'custom-repo-ext',
        name: 'Custom Repo Extension',
        repositoryUrl: customRepoUrl,
      });

      // Initially no extensions installed
      mockApi.getInstalledExtensions.mockResolvedValueOnce([]);
      mockApi.getAvailableExtensions.mockResolvedValueOnce([defaultRepoExtension, customRepoExtension]);

      // After install, the extension will be installed
      mockApi.installExtension.mockResolvedValue(true);
      mockApi.getInstalledExtensions.mockResolvedValueOnce([createMockLoadedExtension({ id: 'custom-repo-ext' })]);
      mockApi.getAvailableExtensions.mockResolvedValueOnce([defaultRepoExtension, customRepoExtension]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('settings.extensions.tabs.available')).toBeInTheDocument();
      });

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Find and expand the custom repository accordion
      const accordions = screen.getAllByTestId('accordion-toggle');
      const customRepoAccordion = accordions.find((acc) => acc.textContent?.includes(customRepoUrl));

      if (!customRepoAccordion) {
        throw new Error('Custom repository accordion not found');
      }

      // Expand the custom repository
      fireEvent.click(customRepoAccordion);

      // Verify it's expanded
      expect(customRepoAccordion).toHaveAttribute('aria-expanded', 'true');

      // Install an extension from the custom repository
      // Since default repo extension is already installed, only custom repo has install button
      const installButton = await screen.findByText('settings.extensions.install');

      fireEvent.click(installButton);

      // Wait for install to complete and re-render
      await waitFor(() => {
        expect(mockApi.installExtension).toHaveBeenCalledWith('custom-repo-ext', customRepoUrl, undefined);
      });

      // Wait for reload
      await waitFor(() => {
        expect(mockApi.getInstalledExtensions).toHaveBeenCalledTimes(2);
        expect(mockApi.getAvailableExtensions).toHaveBeenCalledTimes(2);
      });

      // Verify the custom repository accordion is still expanded after re-render
      const updatedAccordions = screen.getAllByTestId('accordion-toggle');
      const updatedCustomRepoAccordion = updatedAccordions.find((acc) => acc.textContent?.includes(customRepoUrl));

      expect(updatedCustomRepoAccordion).toHaveAttribute('aria-expanded', 'true');
    });

    it('should preserve expanded state when uninstalling an extension triggers re-render', async () => {
      // Setup: Start with an installed extension
      const installedExtension = createMockLoadedExtension({
        id: 'test-extension',
        metadata: { name: 'Test Extension', version: '1.0.0' },
      });

      const availableExtension = createMockAvailableExtension({
        id: 'test-extension',
        name: 'Test Extension',
        repositoryUrl: AIDER_DESK_EXTENSIONS_REPO_URL,
      });

      const customRepoUrl = 'https://github.com/custom/extensions';
      const customRepoExtension = createMockAvailableExtension({
        id: 'custom-repo-ext',
        name: 'Custom Repo Extension',
        repositoryUrl: customRepoUrl,
      });

      // Initially installed
      mockApi.getInstalledExtensions.mockResolvedValueOnce([installedExtension]);
      mockApi.getAvailableExtensions.mockResolvedValueOnce([availableExtension, customRepoExtension]);

      // After uninstall, no extensions installed
      mockApi.uninstallExtension.mockResolvedValue(true);
      mockApi.getInstalledExtensions.mockResolvedValueOnce([]);
      mockApi.getAvailableExtensions.mockResolvedValueOnce([availableExtension, customRepoExtension]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('settings.extensions.tabs.available')).toBeInTheDocument();
      });

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Expand the custom repository accordion
      const accordions = screen.getAllByTestId('accordion-toggle');
      const customRepoAccordion = accordions.find((acc) => acc.textContent?.includes(customRepoUrl));

      if (!customRepoAccordion) {
        throw new Error('Custom repository accordion not found');
      }

      fireEvent.click(customRepoAccordion);
      expect(customRepoAccordion).toHaveAttribute('aria-expanded', 'true');

      // Uninstall an extension from the default repository
      const uninstallButtons = await screen.findAllByText('settings.extensions.uninstall');
      fireEvent.click(uninstallButtons[0]);

      // Wait for uninstall to complete
      await waitFor(() => {
        expect(mockApi.uninstallExtension).toHaveBeenCalledWith('Test Extension', undefined);
      });

      // Wait for reload
      await waitFor(() => {
        expect(mockApi.getInstalledExtensions).toHaveBeenCalledTimes(2);
        expect(mockApi.getAvailableExtensions).toHaveBeenCalledTimes(2);
      });

      // Verify the custom repository accordion is still expanded after re-render
      const updatedAccordions = screen.getAllByTestId('accordion-toggle');
      const updatedCustomRepoAccordion = updatedAccordions.find((acc) => acc.textContent?.includes(customRepoUrl));

      expect(updatedCustomRepoAccordion).toHaveAttribute('aria-expanded', 'true');
    });

    it('should preserve multiple expanded repositories after install/uninstall operations', async () => {
      const repo1Url = 'https://github.com/repo1/extensions';
      const repo2Url = 'https://github.com/repo2/extensions';

      const ext1 = createMockAvailableExtension({ id: 'ext1', repositoryUrl: repo1Url });
      const ext2 = createMockAvailableExtension({ id: 'ext2', repositoryUrl: repo2Url });
      const defaultExt = createMockAvailableExtension({ id: 'default-ext', repositoryUrl: AIDER_DESK_EXTENSIONS_REPO_URL });

      // Setup settings with multiple repositories
      mockSettings = {
        ...mockSettings,
        extensions: {
          repositories: [AIDER_DESK_EXTENSIONS_REPO_URL, repo1Url, repo2Url],
          disabled: [],
        },
      } as unknown as SettingsData;

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([defaultExt, ext1, ext2]);

      mockApi.installExtension.mockResolvedValue(true);
      mockApi.getInstalledExtensions.mockResolvedValueOnce([createMockLoadedExtension({ id: 'ext1' })]);
      mockApi.getAvailableExtensions.mockResolvedValueOnce([defaultExt, ext1, ext2]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Expand both custom repositories
      const accordions = screen.getAllByTestId('accordion-toggle');
      const repo1Accordion = accordions.find((acc) => acc.textContent?.includes(repo1Url));
      const repo2Accordion = accordions.find((acc) => acc.textContent?.includes(repo2Url));

      if (!repo1Accordion || !repo2Accordion) {
        throw new Error('Repository accordions not found');
      }

      fireEvent.click(repo1Accordion);
      fireEvent.click(repo2Accordion);

      expect(repo1Accordion).toHaveAttribute('aria-expanded', 'true');
      expect(repo2Accordion).toHaveAttribute('aria-expanded', 'true');

      // Install an extension from repo1 (first available install button)
      const installButton = await screen.findByText('settings.extensions.install');
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(mockApi.installExtension).toHaveBeenCalled();
      });

      // Wait for reload
      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalledTimes(2);
      });

      // Verify both repositories are still expanded
      const updatedAccordions = screen.getAllByTestId('accordion-toggle');
      const updatedRepo1Accordion = updatedAccordions.find((acc) => acc.textContent?.includes(repo1Url));
      const updatedRepo2Accordion = updatedAccordions.find((acc) => acc.textContent?.includes(repo2Url));

      expect(updatedRepo1Accordion).toHaveAttribute('aria-expanded', 'true');
      expect(updatedRepo2Accordion).toHaveAttribute('aria-expanded', 'true');
    });

    it('should preserve collapsed state when other repositories are toggled', async () => {
      const customRepoUrl = 'https://github.com/custom/extensions';
      const defaultExt = createMockAvailableExtension({ repositoryUrl: AIDER_DESK_EXTENSIONS_REPO_URL });
      const customExt = createMockAvailableExtension({ id: 'custom-ext', repositoryUrl: customRepoUrl });

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([defaultExt, customExt]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Find both accordions
      const accordions = screen.getAllByTestId('accordion-toggle');
      const defaultAccordion = accordions.find((acc) => acc.textContent?.includes(AIDER_DESK_EXTENSIONS_REPO_URL));
      const customAccordion = accordions.find((acc) => acc.textContent?.includes(customRepoUrl));

      if (!defaultAccordion || !customAccordion) {
        throw new Error('Repository accordions not found');
      }

      // Verify both start collapsed
      expect(defaultAccordion).toHaveAttribute('aria-expanded', 'false');
      expect(customAccordion).toHaveAttribute('aria-expanded', 'false');

      // Expand only the default repository
      fireEvent.click(defaultAccordion);

      expect(defaultAccordion).toHaveAttribute('aria-expanded', 'true');
      expect(customAccordion).toHaveAttribute('aria-expanded', 'false');

      // Toggle the default repository off and on again
      fireEvent.click(defaultAccordion);
      fireEvent.click(defaultAccordion);

      // Default should be expanded, custom should remain collapsed
      expect(defaultAccordion).toHaveAttribute('aria-expanded', 'true');
      expect(customAccordion).toHaveAttribute('aria-expanded', 'false');
    });

    it('should preserve expansion state when refreshing extensions', async () => {
      const customRepoUrl = 'https://github.com/custom/extensions';
      const defaultExt = createMockAvailableExtension({ repositoryUrl: AIDER_DESK_EXTENSIONS_REPO_URL });
      const customExt = createMockAvailableExtension({ id: 'custom-ext', repositoryUrl: customRepoUrl });

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([defaultExt, customExt]);

      // Setup for refresh
      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([defaultExt, customExt]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Expand the custom repository
      const accordions = screen.getAllByTestId('accordion-toggle');
      const customAccordion = accordions.find((acc) => acc.textContent?.includes(customRepoUrl));

      if (!customAccordion) {
        throw new Error('Custom repository accordion not found');
      }

      fireEvent.click(customAccordion);
      expect(customAccordion).toHaveAttribute('aria-expanded', 'true');

      // Click refresh button
      const refreshButton = screen.getByText('common.refresh');
      fireEvent.click(refreshButton);

      // Wait for refresh to complete
      await waitFor(() => {
        expect(mockApi.getInstalledExtensions).toHaveBeenCalledTimes(2);
        expect(mockApi.getAvailableExtensions).toHaveBeenCalledTimes(2); // Initial load + refresh
      });

      // Verify custom repository is still expanded
      const updatedAccordions = screen.getAllByTestId('accordion-toggle');
      const updatedCustomAccordion = updatedAccordions.find((acc) => acc.textContent?.includes(customRepoUrl));

      expect(updatedCustomAccordion).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Extension Install/Uninstall Operations', () => {
    it('should successfully install an extension', async () => {
      const extension = createMockAvailableExtension();

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([extension]);
      mockApi.installExtension.mockResolvedValue(true);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      // Wait for extensions to load
      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Expand the repository accordion to see the install button
      const accordionToggle = screen.getByTestId('accordion-toggle');
      fireEvent.click(accordionToggle);

      // Wait for accordion to expand
      await waitFor(() => {
        expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
      });

      // Install the extension - find by text content within the accordion
      const accordionContent = screen.getByTestId('accordion-content');
      const installButton = await within(accordionContent).findByText((content, element) => {
        return element?.tagName === 'BUTTON' && content.includes('settings.extensions.install');
      });
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(mockApi.installExtension).toHaveBeenCalledWith(extension.id, extension.repositoryUrl, undefined);
      });
    });

    it('should successfully uninstall an extension', async () => {
      const extension = createMockLoadedExtension();
      const availableExtension = createMockAvailableExtension();

      // Setup mocks in correct order:
      // 1. Initial load - extension is installed
      // 2. After uninstall - extension is removed
      mockApi.getInstalledExtensions.mockResolvedValueOnce([extension]).mockResolvedValueOnce([]);
      mockApi.getAvailableExtensions.mockResolvedValueOnce([availableExtension]).mockResolvedValueOnce([availableExtension]);
      mockApi.uninstallExtension.mockResolvedValue(true);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      // Wait for extensions to load
      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Expand the repository accordion
      const accordionToggle = screen.getByTestId('accordion-toggle');
      fireEvent.click(accordionToggle);

      // Wait for accordion to expand
      await waitFor(() => {
        expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
      });

      // Uninstall the extension
      const uninstallButtons = await screen.findAllByText('settings.extensions.uninstall');
      expect(uninstallButtons.length).toBeGreaterThan(0);
      fireEvent.click(uninstallButtons[0]);

      await waitFor(() => {
        expect(mockApi.uninstallExtension).toHaveBeenCalledWith(extension.metadata.name, undefined);
      });
    });

    it('should handle install failure gracefully', async () => {
      const extension = createMockAvailableExtension();

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([extension]);
      mockApi.installExtension.mockResolvedValue(false);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      // Wait for extensions to load
      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Expand the repository accordion
      const accordionToggle = screen.getByTestId('accordion-toggle');
      fireEvent.click(accordionToggle);

      // Wait for accordion to expand
      await waitFor(() => {
        expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
      });

      // Try to install the extension
      const installButton = await screen.findByText('settings.extensions.install');
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(mockApi.installExtension).toHaveBeenCalled();
      });

      // Should not reload extensions on failure
      expect(mockApi.getInstalledExtensions).toHaveBeenCalledTimes(1);
    });

    it('should handle uninstall failure gracefully', async () => {
      const extension = createMockLoadedExtension();
      const availableExtension = createMockAvailableExtension();

      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([availableExtension]);
      mockApi.uninstallExtension.mockResolvedValue(false);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(screen.getByText('settings.extensions.uninstall')).toBeInTheDocument();
      });

      // Expand the repository accordion
      const accordionToggle = screen.getByTestId('accordion-toggle');
      fireEvent.click(accordionToggle);

      // Wait for accordion to expand
      await waitFor(() => {
        expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
      });

      // Try to uninstall the extension (use first match)
      const uninstallButtons = await screen.findAllByText('settings.extensions.uninstall');
      fireEvent.click(uninstallButtons[0]);

      await waitFor(() => {
        expect(mockApi.uninstallExtension).toHaveBeenCalled();
      });

      // Should not reload extensions on failure
      expect(mockApi.getInstalledExtensions).toHaveBeenCalledTimes(1);
    });
  });

  describe('Repository Management', () => {
    it('should add a new repository', async () => {
      const newRepoUrl = 'https://github.com/new/extensions';

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(screen.getByTestId('repository-url-input')).toBeInTheDocument();
      });

      // Enter new repository URL
      const input = screen.getByTestId('repository-url-input');
      fireEvent.change(input, { target: { value: newRepoUrl } });

      // Click add button
      const addButton = screen.getByText('settings.extensions.repositories.add');
      fireEvent.click(addButton);

      expect(mockSetSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.objectContaining({
            repositories: expect.arrayContaining([newRepoUrl]),
          }),
        }),
      );
    });

    it('should prevent adding duplicate repositories', async () => {
      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(screen.getByTestId('repository-url-input')).toBeInTheDocument();
      });

      // Try to add default repository again
      const input = screen.getByTestId('repository-url-input');
      fireEvent.change(input, { target: { value: AIDER_DESK_EXTENSIONS_REPO_URL } });

      const addButton = screen.getByText('settings.extensions.repositories.add');
      fireEvent.click(addButton);

      // Should not call setSettings
      expect(mockSetSettings).not.toHaveBeenCalled();
    });

    it('should remove a custom repository', async () => {
      const customRepoUrl = 'https://github.com/custom/extensions';
      const defaultExt = createMockAvailableExtension({ repositoryUrl: AIDER_DESK_EXTENSIONS_REPO_URL });
      const customExt = createMockAvailableExtension({ id: 'custom-ext', repositoryUrl: customRepoUrl });

      mockSettings = {
        ...mockSettings,
        extensions: {
          repositories: [AIDER_DESK_EXTENSIONS_REPO_URL, customRepoUrl],
          disabled: [],
        },
      } as unknown as SettingsData;

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([defaultExt, customExt]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Find and click the remove button for custom repository
      const removeButtons = screen.getAllByTestId('icon-button');
      const customRepoRemoveButton = removeButtons.find((btn) => btn.title === 'settings.extensions.repositories.remove');

      if (!customRepoRemoveButton) {
        throw new Error('Remove button not found');
      }

      fireEvent.click(customRepoRemoveButton);

      expect(mockSetSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.objectContaining({
            repositories: expect.not.arrayContaining([customRepoUrl]),
          }),
        }),
      );
    });

    it('should prevent removing the default repository', async () => {
      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // The default repository should not have a remove button
      const removeButtons = screen.queryAllByTestId('icon-button');
      expect(removeButtons.length).toBe(0); // Default repo has no remove button
    });
  });

  describe('Enable/Disable Extensions', () => {
    it('should toggle extension enabled state', async () => {
      const extension = createMockLoadedExtension();

      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByTestId('checkbox')).toBeInTheDocument();
      });

      // Disable the extension
      const checkbox = screen.getByTestId('checkbox');
      fireEvent.click(checkbox);

      expect(mockSetSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.objectContaining({
            disabled: expect.arrayContaining([extension.metadata.name]),
          }),
        }),
      );
    });

    it('should re-enable a disabled extension', async () => {
      const extension = createMockLoadedExtension();

      mockSettings = {
        ...mockSettings,
        extensions: {
          repositories: [AIDER_DESK_EXTENSIONS_REPO_URL],
          disabled: [extension.metadata.name],
        },
      } as unknown as SettingsData;

      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByTestId('checkbox')).toBeInTheDocument();
      });

      // Re-enable the extension
      const checkbox = screen.getByTestId('checkbox');
      fireEvent.click(checkbox);

      expect(mockSetSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.objectContaining({
            disabled: expect.not.arrayContaining([extension.metadata.name]),
          }),
        }),
      );
    });
  });

  describe('Tab Navigation', () => {
    it('should switch between Installed and Available tabs', async () => {
      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Both tabs should be present
      const installedTab = screen.getByText('settings.extensions.tabs.installed');
      const availableTab = screen.getByText('settings.extensions.tabs.available');

      expect(installedTab).toBeInTheDocument();
      expect(availableTab).toBeInTheDocument();

      // Switch to Available tab
      fireEvent.click(availableTab);

      // Should show repository input (Available tab content)
      await waitFor(() => {
        const input = screen.getByTestId('repository-url-input');
        expect(input).toBeVisible();
      });

      // Switch back to Installed tab
      fireEvent.click(installedTab);

      // Should show installed extensions content, not repository input
      await waitFor(() => {
        // The input exists but is hidden
        const input = screen.getByTestId('repository-url-input');
        expect(input).not.toBeVisible();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching installed extensions', async () => {
      mockApi.getInstalledExtensions.mockImplementation(() => new Promise(() => {})); // Never resolves
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('settings.extensions.loading')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching available extensions', async () => {
      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(screen.getByText('settings.extensions.loading')).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no extensions are installed', async () => {
      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('settings.extensions.installed.empty')).toBeInTheDocument();
      });
    });

    it('should show empty state when no extensions are available', async () => {
      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(screen.getByText('settings.extensions.available.empty')).toBeInTheDocument();
      });
    });
  });

  describe('Project-Specific Extensions', () => {
    it('should pass project directory to API calls when project context is set', async () => {
      const projectDir = '/path/to/project';

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} selectedProjectContext={projectDir} />);

      await waitFor(() => {
        expect(mockApi.getInstalledExtensions).toHaveBeenCalledWith(projectDir);
        expect(mockApi.getAvailableExtensions).toHaveBeenCalledWith(expect.any(Array), false);
      });
    });

    it('should not pass project directory when global context is selected', async () => {
      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} selectedProjectContext="global" />);

      await waitFor(() => {
        expect(mockApi.getInstalledExtensions).toHaveBeenCalledWith(undefined);
      });
    });
  });
});
