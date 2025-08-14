import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { IoMdAdd, IoMdClose, IoMdRemove } from 'react-icons/io';
import { BiCopy } from 'react-icons/bi';
import clsx from 'clsx';
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
  visible: boolean;
  className?: string;
  onVisibilityChange: (visible: boolean) => void;
  onCopyOutput?: (output: string) => void;
};
export const TerminalView = forwardRef<TerminalViewRef, Props>(({ baseDir, visible, className, onVisibilityChange, onCopyOutput }, ref) => {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<TerminalTab[]>([DEFAULT_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>('default');
  const terminalRefs = useRef<Record<string, TerminalRef | null>>({});

  useImperativeHandle(ref, () => ({
    resize: () => {
      // Resize all terminal instances
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
        setActiveTabId(newTabs[newTabs.length - 1].id);
      } else if (newTabs.length === 0) {
        const id = uuidv4();
        newTabs.push({
          ...DEFAULT_TAB,
          id: id,
        });
        setActiveTabId(id);
        // If we're closing the last tab, minimize the terminal
        onVisibilityChange(false);
      }

      return newTabs;
    });
  };

  // Focus the active terminal when it changes
  useEffect(() => {
    const activeRef = terminalRefs.current[activeTabId];
    if (activeRef) {
      // Small delay to ensure terminal is rendered
      setTimeout(() => {
        activeRef.focus();
      }, 100);
    }
  }, [activeTabId]);

  // Handle copying terminal output
  const handleCopyOutput = () => {
    const activeRef = terminalRefs.current[activeTabId];
    if (activeRef && onCopyOutput) {
      const output = activeRef.getOutput();
      onCopyOutput(output);
    }
  };

  return (
    <div className={clsx('flex flex-col', visible ? 'block' : 'hidden', className)}>
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
          <div key={tab.id} className={clsx('absolute inset-0')}>
            <TerminalComponent
              key={tab.id}
              ref={(ref) => {
                terminalRefs.current[tab.id] = ref;
              }}
              baseDir={baseDir}
              visible={activeTabId === tab.id && visible}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

TerminalView.displayName = 'TerminalView';
