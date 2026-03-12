import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { IoMdAdd, IoMdClose, IoMdRemove } from 'react-icons/io';
import { BiCopy } from 'react-icons/bi';
import { clsx } from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';

import { Terminal as TerminalComponent, TerminalRef } from '@/components/terminal/Terminal';
import { IconButton } from '@/components/common/IconButton';

export type TerminalViewRef = {
  resize: () => void;
};

type TerminalTab = {
  id: string;
  terminalId: string | null;
};

const DEFAULT_TAB = {
  id: 'default',
  terminalId: null,
};

type Props = {
  baseDir: string;
  taskId: string;
  visible: boolean;
  className?: string;
  onVisibilityChange: (visible: boolean) => void;
  onCopyOutput?: (output: string) => void;
};
export const TerminalView = forwardRef<TerminalViewRef, Props>(({ baseDir, taskId, visible, className, onVisibilityChange, onCopyOutput }, ref) => {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<TerminalTab[]>([DEFAULT_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>('default');
  const terminalRefs = useRef<Record<string, TerminalRef | null>>({});

  useImperativeHandle(ref, () => ({
    resize: () => {
      Object.values(terminalRefs.current).forEach((terminalRef) => {
        terminalRef?.resize();
      });
    },
  }));

  // Create a new terminal tab
  const addTerminalTab = () => {
    const newTabId = uuidv4();
    const newTab: TerminalTab = {
      id: newTabId,
      terminalId: null,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  // Close a terminal tab
  const closeTerminalTab = (tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.id !== tabId);

      // If we're closing the active tab, activate the previous one
      if (activeTabId === tabId && newTabs.length > 0) {
        const newActiveId = newTabs[newTabs.length - 1].id;
        setActiveTabId(newActiveId);
      } else if (newTabs.length === 0) {
        const id = uuidv4();
        newTabs.push({
          ...DEFAULT_TAB,
          id: id,
        });
        setActiveTabId(id);
        onVisibilityChange(false);
      }

      return newTabs;
    });
  };

  // Focus the active terminal when it changes
  useEffect(() => {
    const MAX_RETRY_ATTEMPTS = 10;
    const RETRY_DELAY_MS = 50;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const attemptFocus = () => {
      const activeRef = terminalRefs.current[activeTabId];

      if (!activeRef) {
        return;
      }

      if (activeRef.isReady()) {
        activeRef.focus();
      } else if (retryCount < MAX_RETRY_ATTEMPTS) {
        retryCount++;
        timeoutId = setTimeout(attemptFocus, RETRY_DELAY_MS);
      }
    };

    const activeRef = terminalRefs.current[activeTabId];
    if (!activeRef) {
      return;
    }

    const isReadyBefore = activeRef.isReady();

    if (isReadyBefore) {
      activeRef.focus();
    } else {
      attemptFocus();
    }

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, [activeTabId, visible, tabs]);

  // Resize terminals on window resize
  useEffect(() => {
    const handleResize = () => {
      Object.values(terminalRefs.current).forEach((terminalRef) => {
        terminalRef?.resize();
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle copying terminal output
  const handleCopyOutput = () => {
    const activeRef = terminalRefs.current[activeTabId];
    if (activeRef && onCopyOutput) {
      const output = activeRef.getOutput();
      onCopyOutput(output);
    }
  };

  return (
    <div className={clsx('flex flex-col', visible ? 'visible' : 'invisible', className)}>
      {/* Tab bar */}
      <div className="flex items-center justify-between pl-1 pr-2 bg-bg-primary-light border-b border-border-dark-light">
        <div className="flex items-center space-x-1">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={clsx(
                'flex items-center px-3 py-1 mt-1 text-sm rounded-t-sm cursor-pointer transition-colors',
                activeTabId === tab.id
                  ? 'bg-bg-secondary text-text-primary'
                  : 'bg-bg-primary-light text-text-muted-light hover:bg-bg-secondary-light hover:text-text-secondary',
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="mr-2 truncate max-w-[120px]">{index + 1}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminalTab(tab.id);
                }}
                className="text-text-muted hover:text-text-secondary transition-colors"
              >
                <IoMdClose size={14} />
              </button>
            </div>
          ))}
          <IconButton icon={<IoMdAdd size={16} />} onClick={addTerminalTab} tooltip={t('terminal.addTerminal')} className="px-2 mt-0.5" />
        </div>
        <div className="flex items-center space-x-3">
          <IconButton icon={<BiCopy size={16} />} onClick={handleCopyOutput} tooltip={t('terminal.copyOutput')} />
          <IconButton icon={<IoMdRemove size={16} />} onClick={() => onVisibilityChange(false)} tooltip={t('terminal.minimize')} />
        </div>
      </div>

      {/* Terminal content */}
      <div className="flex-grow relative">
        {tabs.map((tab) => (
          <div key={tab.id} className={clsx('absolute inset-0', activeTabId !== tab.id && 'invisible')}>
            <TerminalComponent
              ref={(ref) => {
                terminalRefs.current[tab.id] = ref;
              }}
              baseDir={baseDir}
              taskId={taskId}
              visible={visible}
              isActive={activeTabId === tab.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

TerminalView.displayName = 'TerminalView';
