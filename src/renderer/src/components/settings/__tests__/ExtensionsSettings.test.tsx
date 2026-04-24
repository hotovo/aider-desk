import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailableExtension, InstalledExtension, SettingsData } from '@common/types';
import { AIDER_DESK_EXTENSIONS_REPO_URL } from '@common/extensions';

import { ExtensionsSettings } from '../ExtensionsSettings';

import { useApi } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

// Test data factories with capabilities support
const createMockAvailableExtension = (overrides: Partial<AvailableExtension> = {}): AvailableExtension => ({
  id: 'test-extension',
  name: 'Test Extension',
  version: '1.0.0',
  description: 'A test extension',
  author: 'Test Author',
  type: 'single',
  repositoryUrl: AIDER_DESK_EXTENSIONS_REPO_URL,
  hasDependencies: false,
  capabilities: ['tools'],
  ...overrides,
});

const createMockLoadedExtension = (overrides: Partial<InstalledExtension> = {}): InstalledExtension => ({
  id: 'test-extension',
  metadata: {
    name: 'Test Extension',
    version: '1.0.0',
    description: 'A test extension',
    author: 'Test Author',
    capabilities: ['tools'],
  },
  filePath: '/mock/path/to/extension.js',
  initialized: true,
  ...overrides,
});

// Type definitions for mocked components
interface MotionDivProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

interface AnimatePresenceProps {
  children?: React.ReactNode;
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

interface ToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
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
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      className={wrapperClassName}
      data-testid={placeholder?.includes('search') ? 'search-input' : 'repository-url-input'}
    />
  ),
}));

vi.mock('@/components/common/Toggle', () => ({
  Toggle: ({ checked, onChange, disabled, 'aria-label': ariaLabel }: ToggleProps) => (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange && onChange(!checked)}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid="toggle"
      />
    </label>
  ),
}));

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

  describe('Repository Expansion State Preservation', () => {
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

      // Find the custom repository section - it should show "custom/extensions" formatted name
      const customRepoSection = screen.getByText('custom/extensions');
      expect(customRepoSection).toBeInTheDocument();

      // Expand the custom repository by clicking on the header
      const customRepoHeader = customRepoSection.closest('div[class*="cursor-pointer"]');
      if (!customRepoHeader) {
        throw new Error('Custom repository header not found');
      }

      fireEvent.click(customRepoHeader);

      // Verify the chevron has rotated (not -rotate-90 anymore)
      await waitFor(() => {
        const chevrons = customRepoHeader.querySelectorAll('svg');
        const chevron = Array.from(chevrons).find((svg) => svg.classList.contains('w-3'));
        expect(chevron).toBeTruthy();
        expect(chevron).not.toHaveClass('-rotate-90');
      });

      // Install an extension from the custom repository
      const installButton = await screen.findByText('settings.extensions.install');
      fireEvent.click(installButton);

      // Wait for install to complete and re-render
      await waitFor(() => {
        expect(mockApi.installExtension).toHaveBeenCalledWith('custom-repo-ext', customRepoUrl, undefined);
      });

      // Wait for reload
      await waitFor(() => {
        expect(mockApi.getInstalledExtensions).toHaveBeenCalledTimes(2);
      });

      // Verify the custom repository section is still expanded after re-render
      const updatedCustomRepoSection = screen.getByText('custom/extensions');
      const updatedCustomRepoHeader = updatedCustomRepoSection.closest('div[class*="cursor-pointer"]');

      if (!updatedCustomRepoHeader) {
        throw new Error('Updated custom repository header not found');
      }

      const updatedChevrons = updatedCustomRepoHeader.querySelectorAll('svg');
      const updatedChevron = Array.from(updatedChevrons).find((svg) => svg.classList.contains('w-3'));
      expect(updatedChevron).not.toHaveClass('-rotate-90');
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

      // Expand the custom repository
      const customRepoSection = screen.getByText('custom/extensions');
      const customRepoHeader = customRepoSection.closest('div[class*="cursor-pointer"]');

      if (!customRepoHeader) {
        throw new Error('Custom repository header not found');
      }

      fireEvent.click(customRepoHeader);

      await waitFor(() => {
        const chevrons = customRepoHeader.querySelectorAll('svg');
        const chevron = Array.from(chevrons).find((svg) => svg.classList.contains('w-3'));
        expect(chevron).toBeTruthy();
        expect(chevron).not.toHaveClass('-rotate-90');
      });

      // Uninstall an extension from the default repository
      const uninstallButtons = await screen.findAllByText('settings.extensions.uninstall');
      fireEvent.click(uninstallButtons[0]);

      // Wait for uninstall to complete
      await waitFor(() => {
        expect(mockApi.uninstallExtension).toHaveBeenCalledWith('/mock/path/to/extension.js', undefined);
      });

      // Wait for reload
      await waitFor(() => {
        expect(mockApi.getInstalledExtensions).toHaveBeenCalledTimes(2);
        expect(mockApi.getAvailableExtensions).toHaveBeenCalledTimes(2);
      });

      // Verify the custom repository is still expanded after re-render
      const updatedCustomRepoSection = screen.getByText('custom/extensions');
      const updatedCustomRepoHeader = updatedCustomRepoSection.closest('div[class*="cursor-pointer"]');

      if (!updatedCustomRepoHeader) {
        throw new Error('Updated custom repository header not found');
      }

      const updatedChevrons = updatedCustomRepoHeader.querySelectorAll('svg');
      const updatedChevron = Array.from(updatedChevrons).find((svg) => svg.classList.contains('w-3'));
      expect(updatedChevron).not.toHaveClass('-rotate-90');
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
      const repo1Section = screen.getByText('repo1/extensions');
      const repo2Section = screen.getByText('repo2/extensions');

      const repo1Header = repo1Section.closest('div[class*="cursor-pointer"]');
      const repo2Header = repo2Section.closest('div[class*="cursor-pointer"]');

      if (!repo1Header || !repo2Header) {
        throw new Error('Repository headers not found');
      }

      fireEvent.click(repo1Header);
      fireEvent.click(repo2Header);

      // Verify both are expanded
      await waitFor(() => {
        const repo1Chevrons = repo1Header.querySelectorAll('svg');
        const repo1Chevron = Array.from(repo1Chevrons).find((svg) => svg.classList.contains('w-3'));
        const repo2Chevrons = repo2Header.querySelectorAll('svg');
        const repo2Chevron = Array.from(repo2Chevrons).find((svg) => svg.classList.contains('w-3'));
        expect(repo1Chevron).not.toHaveClass('-rotate-90');
        expect(repo2Chevron).not.toHaveClass('-rotate-90');
      });

      // Install an extension from repo1
      const installButton = await screen.findByText('settings.extensions.install');
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(mockApi.installExtension).toHaveBeenCalled();
      });

      // Wait for reload
      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalledTimes(1);
      });

      // Verify both repositories are still expanded
      const updatedRepo1Section = screen.getByText('repo1/extensions');
      const updatedRepo2Section = screen.getByText('repo2/extensions');

      const updatedRepo1Header = updatedRepo1Section.closest('div[class*="cursor-pointer"]');
      const updatedRepo2Header = updatedRepo2Section.closest('div[class*="cursor-pointer"]');

      if (!updatedRepo1Header || !updatedRepo2Header) {
        throw new Error('Updated repository headers not found');
      }

      const updatedRepo1Chevrons = updatedRepo1Header.querySelectorAll('svg');
      const updatedRepo1Chevron = Array.from(updatedRepo1Chevrons).find((svg) => svg.classList.contains('w-3'));
      const updatedRepo2Chevrons = updatedRepo2Header.querySelectorAll('svg');
      const updatedRepo2Chevron = Array.from(updatedRepo2Chevrons).find((svg) => svg.classList.contains('w-3'));

      expect(updatedRepo1Chevron).not.toHaveClass('-rotate-90');
      expect(updatedRepo2Chevron).not.toHaveClass('-rotate-90');
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

      // Find both repository sections
      const defaultRepoSection = screen.getByText('hotovo/aider-desk');
      const customRepoSection = screen.getByText('custom/extensions');

      const defaultRepoHeader = defaultRepoSection.closest('div[class*="cursor-pointer"]');
      const customRepoHeader = customRepoSection.closest('div[class*="cursor-pointer"]');

      if (!defaultRepoHeader || !customRepoHeader) {
        throw new Error('Repository headers not found');
      }

      // Verify both start collapsed (have -rotate-90 class)
      const defaultChevrons = defaultRepoHeader.querySelectorAll('svg');
      const defaultChevron = Array.from(defaultChevrons).find((svg) => svg.classList.contains('w-3'));
      const customChevrons = customRepoHeader.querySelectorAll('svg');
      const customChevron = Array.from(customChevrons).find((svg) => svg.classList.contains('w-3'));

      expect(defaultChevron).toHaveClass('-rotate-90');
      expect(customChevron).toHaveClass('-rotate-90');

      // Expand only the default repository
      fireEvent.click(defaultRepoHeader);

      await waitFor(() => {
        const updatedDefaultChevrons = defaultRepoHeader.querySelectorAll('svg');
        const updatedDefaultChevron = Array.from(updatedDefaultChevrons).find((svg) => svg.classList.contains('w-3'));
        const updatedCustomChevrons = customRepoHeader.querySelectorAll('svg');
        const updatedCustomChevron = Array.from(updatedCustomChevrons).find((svg) => svg.classList.contains('w-3'));

        expect(updatedDefaultChevron).not.toHaveClass('-rotate-90');
        expect(updatedCustomChevron).toHaveClass('-rotate-90');
      });

      // Toggle the default repository off and on again
      fireEvent.click(defaultRepoHeader);
      fireEvent.click(defaultRepoHeader);

      // Default should be expanded, custom should remain collapsed
      await waitFor(() => {
        const finalDefaultChevrons = defaultRepoHeader.querySelectorAll('svg');
        const finalDefaultChevron = Array.from(finalDefaultChevrons).find((svg) => svg.classList.contains('w-3'));
        const finalCustomChevrons = customRepoHeader.querySelectorAll('svg');
        const finalCustomChevron = Array.from(finalCustomChevrons).find((svg) => svg.classList.contains('w-3'));

        expect(finalDefaultChevron).not.toHaveClass('-rotate-90');
        expect(finalCustomChevron).toHaveClass('-rotate-90');
      });
    });

    it('should preserve expansion state when refreshing extensions', async () => {
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

      // Expand the custom repository
      const customRepoSection = screen.getByText('custom/extensions');
      const customRepoHeader = customRepoSection.closest('div[class*="cursor-pointer"]');

      if (!customRepoHeader) {
        throw new Error('Custom repository header not found');
      }

      fireEvent.click(customRepoHeader);

      await waitFor(() => {
        const chevrons = customRepoHeader.querySelectorAll('svg');
        const chevron = Array.from(chevrons).find((svg) => svg.classList.contains('w-3'));
        expect(chevron).not.toHaveClass('-rotate-90');
      });

      // Click refresh button
      const refreshButton = screen.getByText('common.refresh');
      fireEvent.click(refreshButton);

      // Wait for refresh to complete
      await waitFor(() => {
        expect(mockApi.getInstalledExtensions).toHaveBeenCalledTimes(2);
        expect(mockApi.getAvailableExtensions).toHaveBeenCalledTimes(2);
      });

      // Verify custom repository is still expanded
      const updatedCustomRepoSection = screen.getByText('custom/extensions');
      const updatedCustomRepoHeader = updatedCustomRepoSection.closest('div[class*="cursor-pointer"]');

      if (!updatedCustomRepoHeader) {
        throw new Error('Updated custom repository header not found');
      }

      const updatedChevrons = updatedCustomRepoHeader.querySelectorAll('svg');
      const updatedChevron = Array.from(updatedChevrons).find((svg) => svg.classList.contains('w-3'));
      expect(updatedChevron).not.toHaveClass('-rotate-90');
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

      // Expand the repository section
      const repoSection = screen.getByText('hotovo/aider-desk');
      const repoHeader = repoSection.closest('div[class*="cursor-pointer"]');

      if (!repoHeader) {
        throw new Error('Repository header not found');
      }

      fireEvent.click(repoHeader);

      // Wait for section to expand and find install button
      const installButton = await screen.findByText('settings.extensions.install');
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

      // Expand the repository section
      const repoSection = screen.getByText('hotovo/aider-desk');
      const repoHeader = repoSection.closest('div[class*="cursor-pointer"]');

      if (!repoHeader) {
        throw new Error('Repository header not found');
      }

      fireEvent.click(repoHeader);

      // Uninstall the extension
      const uninstallButtons = await screen.findAllByText('settings.extensions.uninstall');
      expect(uninstallButtons.length).toBeGreaterThan(0);
      fireEvent.click(uninstallButtons[0]);

      await waitFor(() => {
        expect(mockApi.uninstallExtension).toHaveBeenCalledWith(extension.filePath, undefined);
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

      // Expand the repository section
      const repoSection = screen.getByText('hotovo/aider-desk');
      const repoHeader = repoSection.closest('div[class*="cursor-pointer"]');

      if (!repoHeader) {
        throw new Error('Repository header not found');
      }

      fireEvent.click(repoHeader);

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

      // Expand the repository section
      const repoSection = screen.getByText('hotovo/aider-desk');
      const repoHeader = repoSection.closest('div[class*="cursor-pointer"]');

      if (!repoHeader) {
        throw new Error('Repository header not found');
      }

      fireEvent.click(repoHeader);

      // Try to uninstall the extension
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

    it('should format GitHub repository names correctly', async () => {
      const customRepoUrl = 'https://github.com/org-name/repo-name';
      const customExt = createMockAvailableExtension({ id: 'custom-ext', repositoryUrl: customRepoUrl });

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([customExt]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Should display formatted name (org/repo)
      expect(screen.getByText('org-name/repo-name')).toBeInTheDocument();
    });
  });

  describe('Enable/Disable Extensions', () => {
    it('should toggle extension enabled state', async () => {
      const extension = createMockLoadedExtension();

      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByTestId('toggle')).toBeInTheDocument();
      });

      // Disable the extension
      const toggle = screen.getByTestId('toggle');
      fireEvent.click(toggle);

      expect(mockSetSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.objectContaining({
            disabled: expect.arrayContaining([extension.filePath]),
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
          disabled: [extension.filePath],
        },
      } as unknown as SettingsData;

      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByTestId('toggle')).toBeInTheDocument();
      });

      // Re-enable the extension
      const toggle = screen.getByTestId('toggle');
      fireEvent.click(toggle);

      expect(mockSetSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.objectContaining({
            disabled: expect.not.arrayContaining([extension.filePath]),
          }),
        }),
      );
    });

    it('should display disabled status badge', async () => {
      const extension = createMockLoadedExtension();

      mockSettings = {
        ...mockSettings,
        extensions: {
          repositories: [AIDER_DESK_EXTENSIONS_REPO_URL],
          disabled: [extension.filePath],
        },
      } as unknown as SettingsData;

      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('settings.extensions.disabled')).toBeInTheDocument();
      });
    });

    it('should display uninstalling status', async () => {
      const extension = createMockLoadedExtension();
      const availableExtension = createMockAvailableExtension();

      // Make uninstall hang so we can see the status
      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([availableExtension]);
      mockApi.uninstallExtension.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Wait for the installed extension to load
      await waitFor(() => {
        expect(screen.getByText('Test Extension')).toBeInTheDocument();
      });

      // Find uninstall button on the Installed tab (easier than Available tab)
      const uninstallButton = screen.getByText('settings.extensions.uninstall');

      // Click uninstall
      fireEvent.click(uninstallButton);

      // Should show uninstalling status
      await waitFor(() => {
        expect(screen.getByText('settings.extensions.uninstalling')).toBeInTheDocument();
      });
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

  describe('Search Functionality', () => {
    it('should render search input field', async () => {
      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('settings.extensions.search.placeholder')).toBeInTheDocument();
      });
    });

    it('should filter installed extensions by name', async () => {
      const extension1 = createMockLoadedExtension({
        id: 'ext-1',
        filePath: '/mock/path/to/extension1.js',
        metadata: { name: 'Alpha Extension', version: '1.0.0' },
      });
      const extension2 = createMockLoadedExtension({
        id: 'ext-2',
        filePath: '/mock/path/to/extension2.js',
        metadata: { name: 'Beta Extension', version: '1.0.0' },
      });

      mockApi.getInstalledExtensions.mockResolvedValue([extension1, extension2]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Extension')).toBeInTheDocument();
        expect(screen.getByText('Beta Extension')).toBeInTheDocument();
      });

      // Search for "Alpha"
      const searchInput = screen.getByPlaceholderText('settings.extensions.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'Alpha' } });

      await waitFor(() => {
        expect(screen.getByText('Alpha Extension')).toBeInTheDocument();
        expect(screen.queryByText('Beta Extension')).not.toBeInTheDocument();
      });
    });

    it('should filter installed extensions by description', async () => {
      const extension1 = createMockLoadedExtension({
        id: 'ext-1',
        filePath: '/mock/path/to/extension1.js',
        metadata: { name: 'Extension 1', version: '1.0.0', description: 'This is a special tool' },
      });
      const extension2 = createMockLoadedExtension({
        id: 'ext-2',
        filePath: '/mock/path/to/extension2.js',
        metadata: { name: 'Extension 2', version: '1.0.0', description: 'A regular extension' },
      });

      mockApi.getInstalledExtensions.mockResolvedValue([extension1, extension2]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('Extension 1')).toBeInTheDocument();
        expect(screen.getByText('Extension 2')).toBeInTheDocument();
      });

      // Search for "special"
      const searchInput = screen.getByPlaceholderText('settings.extensions.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'special' } });

      await waitFor(() => {
        expect(screen.getByText('Extension 1')).toBeInTheDocument();
        expect(screen.queryByText('Extension 2')).not.toBeInTheDocument();
      });
    });
  });

  describe('Capability Filtering', () => {
    it('should filter by selected capability', async () => {
      const extension1 = createMockLoadedExtension({
        metadata: { name: 'Tool Extension', version: '1.0.0', capabilities: ['tools'] },
      });
      const extension2 = createMockLoadedExtension({
        id: 'ext-2',
        filePath: '/mock/path/to/extension2.js',
        metadata: { name: 'No Cap Extension', version: '1.0.0', capabilities: [] },
      });

      mockApi.getInstalledExtensions.mockResolvedValue([extension1, extension2]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('Tool Extension')).toBeInTheDocument();
        expect(screen.getByText('No Cap Extension')).toBeInTheDocument();
      });

      // Click on "tools" capability chip
      const toolsChip = screen.getByRole('button', { name: 'tools' });
      fireEvent.click(toolsChip);

      await waitFor(() => {
        expect(screen.getByText('Tool Extension')).toBeInTheDocument();
        expect(screen.queryByText('No Cap Extension')).not.toBeInTheDocument();
      });
    });

    it('should show empty state when no extensions match capability filter', async () => {
      const extension = createMockLoadedExtension({
        metadata: { name: 'Tool Extension', version: '1.0.0', capabilities: ['tools'] },
      });
      // Add an available extension with 'ui-elements' capability so the chip appears
      const availableExtension = createMockAvailableExtension({
        id: 'ui-ext',
        name: 'UI Extension',
        capabilities: ['ui-elements'],
      });

      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([availableExtension]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('Tool Extension')).toBeInTheDocument();
      });

      // Click on "ui-elements" capability chip (not present in any installed extension)
      const uiChip = screen.getByRole('button', { name: 'ui-elements' });
      fireEvent.click(uiChip);

      await waitFor(() => {
        expect(screen.getByText('settings.extensions.installed.empty')).toBeInTheDocument();
      });
    });

    it('should sort capabilities alphabetically', async () => {
      const extension = createMockLoadedExtension({
        metadata: {
          name: 'Multi Extension',
          version: '1.0.0',
          capabilities: ['zebra', 'alpha', 'middle'],
        },
      });

      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button').filter((btn) => ['zebra', 'alpha', 'middle'].includes(btn.textContent || ''));
        const buttonTexts = buttons.map((btn) => btn.textContent);
        expect(buttonTexts).toEqual(['alpha', 'middle', 'zebra']);
      });
    });
  });

  describe('Combined Search and Capability Filtering', () => {
    it('should filter by both search query and selected capabilities', async () => {
      const extension1 = createMockLoadedExtension({
        id: 'ext-1',
        filePath: '/mock/path/to/extension1.js',
        metadata: { name: 'Alpha Tools', version: '1.0.0', capabilities: ['tools'] },
      });
      const extension2 = createMockLoadedExtension({
        id: 'ext-2',
        filePath: '/mock/path/to/extension2.js',
        metadata: { name: 'Beta Tools', version: '1.0.0', capabilities: ['tools'] },
      });
      const extension3 = createMockLoadedExtension({
        id: 'ext-3',
        filePath: '/mock/path/to/extension3.js',
        metadata: { name: 'Alpha UI', version: '1.0.0', capabilities: ['ui-elements'] },
      });

      mockApi.getInstalledExtensions.mockResolvedValue([extension1, extension2, extension3]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Tools')).toBeInTheDocument();
        expect(screen.getByText('Beta Tools')).toBeInTheDocument();
        expect(screen.getByText('Alpha UI')).toBeInTheDocument();
      });

      // Filter by capability "tools"
      const toolsChip = screen.getByRole('button', { name: 'tools' });
      fireEvent.click(toolsChip);

      await waitFor(() => {
        expect(screen.getByText('Alpha Tools')).toBeInTheDocument();
        expect(screen.getByText('Beta Tools')).toBeInTheDocument();
        expect(screen.queryByText('Alpha UI')).not.toBeInTheDocument();
      });

      // Additionally filter by search "Alpha"
      const searchInput = screen.getByPlaceholderText('settings.extensions.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'Alpha' } });

      await waitFor(() => {
        expect(screen.getByText('Alpha Tools')).toBeInTheDocument();
        expect(screen.queryByText('Beta Tools')).not.toBeInTheDocument();
        expect(screen.queryByText('Alpha UI')).not.toBeInTheDocument();
      });
    });

    it('should show empty state when combined filters match nothing', async () => {
      const extension = createMockLoadedExtension({
        metadata: { name: 'Tool Extension', version: '1.0.0', capabilities: ['tools'] },
      });

      mockApi.getInstalledExtensions.mockResolvedValue([extension]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('Tool Extension')).toBeInTheDocument();
      });

      // Filter by capability "tools"
      const toolsChip = screen.getByRole('button', { name: 'tools' });
      fireEvent.click(toolsChip);

      // Search for non-matching text
      const searchInput = screen.getByPlaceholderText('settings.extensions.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

      await waitFor(() => {
        expect(screen.getByText('settings.extensions.installed.empty')).toBeInTheDocument();
      });
    });

    it('should preserve capability filter when search query changes', async () => {
      const extension1 = createMockLoadedExtension({
        id: 'ext-1',
        filePath: '/mock/path/to/extension1.js',
        metadata: { name: 'Alpha Tools', version: '1.0.0', capabilities: ['tools'] },
      });
      const extension2 = createMockLoadedExtension({
        id: 'ext-2',
        filePath: '/mock/path/to/extension2.js',
        metadata: { name: 'Beta Tools', version: '1.0.0', capabilities: ['tools'] },
      });
      const extension3 = createMockLoadedExtension({
        id: 'ext-3',
        filePath: '/mock/path/to/extension3.js',
        metadata: { name: 'Alpha UI', version: '1.0.0', capabilities: ['ui-elements'] },
      });

      mockApi.getInstalledExtensions.mockResolvedValue([extension1, extension2, extension3]);
      mockApi.getAvailableExtensions.mockResolvedValue([]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Tools')).toBeInTheDocument();
      });

      // Filter by capability "tools"
      const toolsChip = screen.getByRole('button', { name: 'tools' });
      fireEvent.click(toolsChip);

      // Search for "Alpha"
      const searchInput = screen.getByPlaceholderText('settings.extensions.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'Alpha' } });

      await waitFor(() => {
        expect(screen.getByText('Alpha Tools')).toBeInTheDocument();
        expect(screen.queryByText('Beta Tools')).not.toBeInTheDocument();
      });

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        // Both tool extensions should be visible again
        expect(screen.getByText('Alpha Tools')).toBeInTheDocument();
        expect(screen.getByText('Beta Tools')).toBeInTheDocument();
        // UI extension should still be hidden by capability filter
        expect(screen.queryByText('Alpha UI')).not.toBeInTheDocument();
      });
    });

    it('should collect capabilities from both installed and available extensions', async () => {
      const installedExtension = createMockLoadedExtension({
        metadata: { name: 'Installed Tool', version: '1.0.0', capabilities: ['tools'] },
      });
      const availableExtension = createMockAvailableExtension({
        id: 'available-ui',
        name: 'Available UI',
        capabilities: ['ui-elements'],
      });

      mockApi.getInstalledExtensions.mockResolvedValue([installedExtension]);
      mockApi.getAvailableExtensions.mockResolvedValue([availableExtension]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      await waitFor(() => {
        // Both capabilities should be visible
        expect(screen.getByRole('button', { name: 'tools' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'ui-elements' })).toBeInTheDocument();
      });
    });
  });

  describe('Chevron Rotation', () => {
    it('should rotate chevron when repository is expanded', async () => {
      const extension = createMockAvailableExtension();

      mockApi.getInstalledExtensions.mockResolvedValue([]);
      mockApi.getAvailableExtensions.mockResolvedValue([extension]);

      render(<ExtensionsSettings settings={mockSettings} setSettings={mockSetSettings} />);

      // Switch to Available tab
      const availableTab = screen.getByText('settings.extensions.tabs.available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(mockApi.getAvailableExtensions).toHaveBeenCalled();
      });

      // Find repository section
      const repoSection = screen.getByText('hotovo/aider-desk');
      const repoHeader = repoSection.closest('div[class*="cursor-pointer"]');

      if (!repoHeader) {
        throw new Error('Repository header not found');
      }

      // Chevron should be collapsed (rotated)
      const chevrons = repoHeader.querySelectorAll('svg');
      const chevron = Array.from(chevrons).find((svg) => svg.classList.contains('w-3'));
      expect(chevron).toHaveClass('-rotate-90');

      // Expand repository
      fireEvent.click(repoHeader);

      // Chevron should not be rotated when expanded
      await waitFor(() => {
        const expandedChevrons = repoHeader.querySelectorAll('svg');
        const expandedChevron = Array.from(expandedChevrons).find((svg) => svg.classList.contains('w-3'));
        expect(expandedChevron).not.toHaveClass('-rotate-90');
      });

      // Collapse again
      fireEvent.click(repoHeader);

      // Chevron should be rotated again
      await waitFor(() => {
        const collapsedChevrons = repoHeader.querySelectorAll('svg');
        const collapsedChevron = Array.from(collapsedChevrons).find((svg) => svg.classList.contains('w-3'));
        expect(collapsedChevron).toHaveClass('-rotate-90');
      });
    });
  });
});
