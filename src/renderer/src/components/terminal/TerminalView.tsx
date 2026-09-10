import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { IoMdAdd, IoMdClose, IoMdRemove } from 'react-icons/io';
import { BiCopy } from 'react-icons/bi';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import { Terminal as TerminalComponent, TerminalRef } from '@/components/terminal/Terminal';
import { IconButton } from '@/components/common/IconButton';
import {
  getSessionKey,
  useTerminalStore,
  useTerminalTabs,
  useActiveTerminalTabId,
  addTerminalTab,
  removeTerminalTab,
  setActiveTerminalTab,
} from '@/stores/terminalStore';
import { useApi } from '@/contexts/ApiContext';

export type TerminalViewRef = {
  resize: () => void;
};

type Props = {
  baseDir: string;
  taskId: string;
  visible: boolean;
  className?: string;
  onClose: () => void;
  onCopyOutput?: (output: string) => void;
};

export const TerminalView = forwardRef<TerminalViewRef, Props>(({ baseDir, taskId, visible, className, onClose, onCopyOutput }, ref) => {
  const { t } = useTranslation();
  const api = useApi();
  const sessionKey = getSessionKey(baseDir, taskId);
  const tabs = useTerminalTabs(sessionKey);
  const activeTabId = useActiveTerminalTabId(sessionKey);
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
  const addTab = useCallback(() => {
    addTerminalTab(sessionKey);
  }, [sessionKey]);

  // Close a terminal tab and kill its PTY process
  const closeTerminalTab = (tabId: string) => {
    const tab = tabs.find((candidate) => candidate.id === tabId);

    if (tab?.ptyId) {
      void api.closeTerminal(tab.ptyId);
    }

    removeTerminalTab(sessionKey, tabId);
    delete terminalRefs.current[tabId];

    if (tabs.length === 1) {
      onClose();
    }
  };

  // Ensure there is at least one tab when the terminal view becomes visible
  useEffect(() => {
    if (visible && (useTerminalStore.getState().tabsMap.get(sessionKey)?.length ?? 0) === 0) {
      addTab();
    }
    // Only react to visibility changes, not to tab count changes
  }, [visible, addTab, sessionKey]);

  // Focus the active terminal when the terminal view becomes visible
  useEffect(() => {
    if (visible && activeTabId) {
      const activeRef = terminalRefs.current[activeTabId];
      if (activeRef) {
        // Small delay to ensure terminal is rendered
        setTimeout(() => {
          activeRef.focus();
        }, 100);
      }
    }
  }, [visible, activeTabId]);

  // Handle copying terminal output
  const handleCopyOutput = () => {
    const activeRef = activeTabId && terminalRefs.current[activeTabId];
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
              onClick={() => setActiveTerminalTab(sessionKey, tab.id)}
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
          <IconButton icon={<IoMdAdd size={16} />} onClick={addTab} tooltip={t('terminal.addTerminal')} className="px-2 mt-0.5" />
        </div>
        <div className="flex items-center space-x-3">
          <IconButton icon={<BiCopy size={16} />} onClick={handleCopyOutput} tooltip={t('terminal.copyOutput')} />
          <IconButton icon={<IoMdRemove size={16} />} onClick={onClose} tooltip={t('terminal.minimize')} />
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
              sessionKey={sessionKey}
              tabId={tab.id}
              baseDir={baseDir}
              taskId={taskId}
              visible={activeTabId === tab.id && visible}
              ptyId={tab.ptyId}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

TerminalView.displayName = 'TerminalView';
