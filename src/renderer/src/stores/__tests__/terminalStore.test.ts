import { beforeEach, describe, expect, it } from 'vitest';

import { getSessionKey, useTerminalStore } from '../terminalStore';

describe('terminalStore', () => {
  const sessionKey = getSessionKey('/project', 'task-1');

  beforeEach(() => {
    useTerminalStore.setState({ tabsMap: new Map(), activeTabMap: new Map(), visibleMap: new Map() });
  });

  it('adds a tab and makes it active', () => {
    const { addTab } = useTerminalStore.getState();

    const tabId = addTab(sessionKey);
    const state = useTerminalStore.getState();

    expect(state.tabsMap.get(sessionKey)).toEqual([{ id: tabId, ptyId: null }]);
    expect(state.activeTabMap.get(sessionKey)).toBe(tabId);
  });

  it('removes a tab and activates the previous one', () => {
    const { addTab, removeTab } = useTerminalStore.getState();
    const firstTabId = addTab(sessionKey);
    const secondTabId = addTab(sessionKey);

    removeTab(sessionKey, secondTabId);

    const state = useTerminalStore.getState();
    expect(state.tabsMap.get(sessionKey)?.map((tab) => tab.id)).toEqual([firstTabId]);
    expect(state.activeTabMap.get(sessionKey)).toBe(firstTabId);
  });

  it('clears the active tab when removing the last tab', () => {
    const { addTab, removeTab } = useTerminalStore.getState();
    const tabId = addTab(sessionKey);

    removeTab(sessionKey, tabId);

    const state = useTerminalStore.getState();
    expect(state.tabsMap.get(sessionKey)).toEqual([]);
    expect(state.activeTabMap.get(sessionKey)).toBeNull();
  });

  it('sets the pty id for a tab', () => {
    const { addTab, setTabPtyId } = useTerminalStore.getState();
    const tabId = addTab(sessionKey);

    setTabPtyId(sessionKey, tabId, 'pty-1');

    expect(useTerminalStore.getState().tabsMap.get(sessionKey)?.[0].ptyId).toBe('pty-1');
  });

  it('clears the pty id of the tab owning an exited pty', () => {
    const { addTab, setTabPtyId, handlePtyExit } = useTerminalStore.getState();
    const firstTabId = addTab(sessionKey);
    const secondTabId = addTab(sessionKey);
    setTabPtyId(sessionKey, firstTabId, 'pty-1');
    setTabPtyId(sessionKey, secondTabId, 'pty-2');

    handlePtyExit('pty-1');

    const tabs = useTerminalStore.getState().tabsMap.get(sessionKey);
    expect(tabs?.find((tab) => tab.id === firstTabId)?.ptyId).toBeNull();
    expect(tabs?.find((tab) => tab.id === secondTabId)?.ptyId).toBe('pty-2');
  });

  it('ignores exit events for unknown ptys', () => {
    const { addTab, setTabPtyId, handlePtyExit } = useTerminalStore.getState();
    const tabId = addTab(sessionKey);
    setTabPtyId(sessionKey, tabId, 'pty-1');

    handlePtyExit('pty-unknown');

    expect(useTerminalStore.getState().tabsMap.get(sessionKey)?.[0].ptyId).toBe('pty-1');
  });

  it('keeps sessions of different tasks isolated', () => {
    const { addTab } = useTerminalStore.getState();
    const otherSessionKey = getSessionKey('/project', 'task-2');

    const firstTabId = addTab(sessionKey);
    const secondTabId = addTab(otherSessionKey);

    const state = useTerminalStore.getState();
    expect(state.tabsMap.get(sessionKey)?.map((tab) => tab.id)).toEqual([firstTabId]);
    expect(state.tabsMap.get(otherSessionKey)?.map((tab) => tab.id)).toEqual([secondTabId]);
    expect(state.activeTabMap.get(sessionKey)).toBe(firstTabId);
    expect(state.activeTabMap.get(otherSessionKey)).toBe(secondTabId);
  });

  it('stores visibility per session', () => {
    const { setVisible } = useTerminalStore.getState();

    setVisible(sessionKey, true);

    expect(useTerminalStore.getState().visibleMap.get(sessionKey)).toBe(true);
    expect(useTerminalStore.getState().visibleMap.get(getSessionKey('/project', 'task-2'))).toBeUndefined();
  });
});
