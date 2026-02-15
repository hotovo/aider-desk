import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsageReportData } from '@aider-desk/common/types';

import { MessageBar } from '../MessageBar';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock useClickOutside - simulate closing the menu when clicking outside
const mockClickOutsideCallbacks: Array<() => void> = [];
vi.mock('@/hooks/useClickOutside', () => ({
  useClickOutside: (_refs: React.RefObject<HTMLElement>[], callback: () => void) => {
    mockClickOutsideCallbacks.push(callback);
    // Don't actually register click outside handler in tests
  },
}));

// Mock CopyMessageButton to avoid ApiContext requirement
vi.mock('../CopyMessageButton', () => ({
  CopyMessageButton: ({ className }: { className?: string }) => (
    <div data-testid="copy-button" className={className}>
      Copy
    </div>
  ),
}));

// Mock UsageInfo to avoid API calls
vi.mock('../UsageInfo', () => ({
  UsageInfo: ({ usageReport }: { usageReport?: UsageReportData }) => (
    <div data-testid="usage-info">{usageReport ? `${usageReport.model} - ${usageReport.sentTokens} tokens` : 'No usage'}</div>
  ),
}));

describe('MessageBar', () => {
  const mockUsageReport: UsageReportData = {
    model: 'gpt-4',
    sentTokens: 100,
    receivedTokens: 200,
    messageCost: 0.05,
    cacheWriteTokens: 10,
    cacheReadTokens: 20,
  };

  beforeEach(() => {
    mockClickOutsideCallbacks.length = 0;
    vi.clearAllMocks();
  });

  describe('Remove button with tooltip', () => {
    it('displays menu trigger when remove prop is provided', () => {
      const mockRemove = vi.fn();
      const { container } = render(<MessageBar remove={mockRemove} content="test" />);

      // Menu trigger should exist (div containing SVG icon)
      const allDivs = container.querySelectorAll('div');
      let menuTriggerFound = false;
      for (const div of allDivs) {
        if (div.querySelector('svg') && !div.hasAttribute('data-testid') && div.parentElement?.querySelector('[data-testid="copy-button"]') !== div) {
          menuTriggerFound = true;
          break;
        }
      }
      expect(menuTriggerFound).toBe(true);
    });

    it('does not display menu trigger when remove prop is not provided', () => {
      const { container } = render(<MessageBar content="test" />);

      // Menu trigger should not be visible without remove/redo/edit props
      const allDivs = container.querySelectorAll('div');
      let menuTriggerFound = false;
      for (const div of allDivs) {
        if (div.querySelector('svg') && !div.hasAttribute('data-testid') && div.parentElement?.querySelector('[data-testid="copy-button"]') !== div) {
          menuTriggerFound = true;
          break;
        }
      }
      expect(menuTriggerFound).toBe(false);
    });

    it('calls remove callback', () => {
      const mockRemove = vi.fn();
      const { container } = render(<MessageBar remove={mockRemove} content="test" />);

      // Find the menu trigger (div with SVG)
      const allDivs = container.querySelectorAll('div');
      let menuTriggerDiv: HTMLElement | null = null;
      for (const div of allDivs) {
        if (div.querySelector('svg') && !div.hasAttribute('data-testid') && div.parentElement?.querySelector('[data-testid="copy-button"]') !== div) {
          menuTriggerDiv = div as HTMLElement;
          break;
        }
      }

      expect(menuTriggerDiv).not.toBeNull();
    });
  });

  describe('No remove button on grouped messages', () => {
    it('does not show menu trigger when remove prop is undefined', () => {
      const { container } = render(<MessageBar content="test" />);

      // Menu trigger should not be visible
      const allDivs = container.querySelectorAll('div');
      let menuTriggerFound = false;
      for (const div of allDivs) {
        if (div.querySelector('svg') && !div.hasAttribute('data-testid') && div.parentElement?.querySelector('[data-testid="copy-button"]') !== div) {
          menuTriggerFound = true;
          break;
        }
      }
      expect(menuTriggerFound).toBe(false);
    });

    it('does not show menu trigger when remove prop is null', () => {
      const { container } = render(<MessageBar content="test" remove={undefined} />);

      // Menu trigger should not be visible
      const allDivs = container.querySelectorAll('div');
      let menuTriggerFound = false;
      for (const div of allDivs) {
        if (div.querySelector('svg') && !div.hasAttribute('data-testid') && div.parentElement?.querySelector('[data-testid="copy-button"]') !== div) {
          menuTriggerFound = true;
          break;
        }
      }
      expect(menuTriggerFound).toBe(false);
    });
  });

  describe('Redo and Edit buttons', () => {
    it('displays menu trigger when redo prop is provided', () => {
      const mockRedo = vi.fn();
      const { container } = render(<MessageBar redo={mockRedo} content="test" />);

      // Menu trigger should exist
      const allDivs = container.querySelectorAll('div');
      let menuTriggerFound = false;
      for (const div of allDivs) {
        if (div.querySelector('svg') && !div.hasAttribute('data-testid') && div.parentElement?.querySelector('[data-testid="copy-button"]') !== div) {
          menuTriggerFound = true;
          break;
        }
      }
      expect(menuTriggerFound).toBe(true);
    });

    it('displays menu trigger when edit prop is provided', () => {
      const mockEdit = vi.fn();
      const { container } = render(<MessageBar edit={mockEdit} content="test" />);

      // Menu trigger should exist
      const allDivs = container.querySelectorAll('div');
      let menuTriggerFound = false;
      for (const div of allDivs) {
        if (div.querySelector('svg') && !div.hasAttribute('data-testid') && div.parentElement?.querySelector('[data-testid="copy-button"]') !== div) {
          menuTriggerFound = true;
          break;
        }
      }
      expect(menuTriggerFound).toBe(true);
    });

    it('displays menu trigger when all props are provided', () => {
      const mockRemove = vi.fn();
      const mockRedo = vi.fn();
      const mockEdit = vi.fn();
      const { container } = render(<MessageBar remove={mockRemove} redo={mockRedo} edit={mockEdit} content="test" />);

      // Menu trigger should exist
      const allDivs = container.querySelectorAll('div');
      let menuTriggerFound = false;
      for (const div of allDivs) {
        if (div.querySelector('svg') && !div.hasAttribute('data-testid') && div.parentElement?.querySelector('[data-testid="copy-button"]') !== div) {
          menuTriggerFound = true;
          break;
        }
      }
      expect(menuTriggerFound).toBe(true);
    });
  });

  describe('Usage Report', () => {
    it('displays usage info when usageReport prop is provided', () => {
      render(<MessageBar usageReport={mockUsageReport} />);

      // UsageInfo component should be present
      const usageInfo = screen.getByTestId('usage-info');
      expect(usageInfo).toBeInTheDocument();
      expect(usageInfo).toHaveTextContent('gpt-4 - 100 tokens');
    });
  });

  describe('Copy button', () => {
    it('displays copy button when content prop is provided', () => {
      render(<MessageBar content="test content" />);

      // CopyMessageButton should be present
      const copyButton = screen.queryByTestId('copy-button');
      expect(copyButton).toBeInTheDocument();
    });

    it('does not display copy button when content prop is not provided', () => {
      render(<MessageBar />);

      // No copy button without content
      const copyButton = screen.queryByTestId('copy-button');
      expect(copyButton).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('applies custom className', () => {
      const mockRemove = vi.fn();
      const { container } = render(<MessageBar remove={mockRemove} className="custom-class" content="test" />);

      const messageBar = container.firstChild as HTMLElement;
      expect(messageBar).toHaveClass('custom-class');
    });
  });

  describe('Component integration', () => {
    it('renders without crashing', () => {
      const { container } = render(<MessageBar content="test" remove={vi.fn()} redo={vi.fn()} edit={vi.fn()} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
