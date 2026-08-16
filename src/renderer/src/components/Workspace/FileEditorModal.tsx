import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { HiOutlineExclamation } from 'react-icons/hi';
import { MdLibraryAddCheck, MdSave } from 'react-icons/md';
import { useHotkeys, useHotkeysContext } from 'react-hotkeys-hook';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorView, GutterMarker, gutter, lineNumbers } from '@codemirror/view';
import { githubDarkInit } from '@uiw/codemirror-theme-github';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';

import { remapLineAnchors } from './fileEditorUtils';
import { createInlineChangeRequestsExtension } from './fileEditorInlineRequests';
import { CommentsPanel } from './CommentsPanel';
import { FileEditorTabs } from './FileEditorTabs';

import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DiffLineCommentPanel } from '@/components/common/DiffViewer';
import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { useFileEditorStore } from '@/stores/fileEditorStore';
import { useApi } from '@/contexts/ApiContext';
import { showErrorNotification, showSuccessNotification, showWarningNotification } from '@/utils/notifications';

const EDITOR_THEME = githubDarkInit({
  settings: {
    fontFamily: 'monospace',
    background: 'var(--color-bg-code-block)',
    foreground: 'var(--color-text-primary)',
    selection: 'var(--color-bg-selection)',
    caret: 'var(--color-text-muted)',
    gutterBackground: 'var(--color-bg-code-block)',
    gutterForeground: 'var(--color-text-muted)',
    gutterBorder: 'var(--color-border-default)',
    lineHighlight: 'var(--color-bg-primary-light-strong)',
  },
});

const EDITOR_LAYOUT = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarColor: 'var(--color-bg-secondary-light) var(--color-bg-primary)',
    scrollbarWidth: 'thin',
  },
  '.cm-scroller::-webkit-scrollbar': {
    height: '8px',
    width: '8px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: 'var(--color-bg-primary)',
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--color-bg-secondary-light)',
    borderRadius: '9999px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'var(--color-bg-fourth)',
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '8px 0',
  },
  '.cm-line': {
    padding: '0 12px 0 6px',
  },
  '.cm-gutters': {
    borderRight: '1px solid var(--color-border-default)',
  },
  '.cm-change-request-gutter': {
    borderRight: 'none',
  },
  '.cm-change-request-gutter .cm-gutterElement': {
    alignItems: 'center',
    display: 'flex',
    minWidth: '24px',
    padding: '0 2px',
  },
  '.cm-change-request-button': {
    alignItems: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '3px',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    display: 'flex',
    fontSize: '14px',
    height: '18px',
    justifyContent: 'center',
    opacity: '0',
    padding: '0',
    transition: 'opacity 120ms, background-color 120ms, color 120ms',
    width: '18px',
  },
  '.cm-gutterElement:hover .cm-change-request-button, .cm-change-request-button:focus-visible': {
    opacity: '1',
  },
  '.cm-change-request-button:hover, .cm-change-request-button:focus-visible': {
    backgroundColor: 'var(--color-bg-tertiary)',
    color: 'var(--color-accent-primary)',
    outline: 'none',
  },
});

const BASIC_SETUP = {
  highlightSelectionMatches: true,
  allowMultipleSelections: true,
  lineNumbers: false,
  foldGutter: true,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  autocompletion: true,
};

type PendingComment = {
  id: string;
  filePath: string;
  lineNumber: number;
  position: number;
  comment: string;
};

type ActiveLineInfo = {
  lineNumber: number;
  position: number;
  viewportRect: { top: number; left: number };
};

type EditCommentInfo = {
  commentId: string;
  viewportRect: { top: number; left: number };
  initialText: string;
};

type TabState = {
  savedContent: string | null;
  editorContent: string | null;
  isLoading: boolean;
  error: string | null;
};

type TabViewState = {
  anchor: number;
  head: number;
  scrollTop: number;
};

type LineSelectHandler = (lineNumber: number, position: number, rect: DOMRect) => void;

const createInitialTabState = (isLoading: boolean): TabState => ({
  savedContent: null,
  editorContent: null,
  isLoading,
  error: null,
});

class ChangeRequestGutterMarker extends GutterMarker {
  constructor(
    private readonly lineNumber: number,
    private readonly position: number,
    private readonly label: string,
    private readonly onSelect: LineSelectHandler,
  ) {
    super();
  }

  eq(other: GutterMarker): boolean {
    return (
      other instanceof ChangeRequestGutterMarker &&
      other.lineNumber === this.lineNumber &&
      other.position === this.position &&
      other.label === this.label &&
      other.onSelect === this.onSelect
    );
  }

  toDOM(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-change-request-button';
    button.textContent = '+';
    button.title = this.label;
    button.setAttribute('aria-label', this.label);
    button.dataset.lineNumber = String(this.lineNumber);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onSelect(this.lineNumber, this.position, button.getBoundingClientRect());
    });
    return button;
  }
}

type Props = {
  baseDir: string;
  onClose: () => void;
};

export const FileEditorModal = ({ baseDir, onClose }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const openFiles = useFileEditorStore((state) => state.projectsMap.get(baseDir)?.openFiles ?? []);
  const activeFilePath = useFileEditorStore((state) => state.projectsMap.get(baseDir)?.activeFilePath ?? null);
  const closeTab = useFileEditorStore((state) => state.closeTab);
  const closeTabs = useFileEditorStore((state) => state.closeTabs);
  const setActiveFile = useFileEditorStore((state) => state.setActiveFile);

  const { enableScope, disableScope } = useHotkeysContext();
  useEffect(() => {
    disableScope('home');
    return () => {
      enableScope('home');
    };
  }, [disableScope, enableScope]);

  const [tabsState, setTabsState] = useState<Record<string, TabState>>({});
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const pendingCommentsRef = useRef<PendingComment[]>([]);
  const tabsStateRef = useRef<Record<string, TabState>>({});
  const tabViewStatesRef = useRef<Record<string, TabViewState>>({});
  const editorViewRef = useRef<EditorView | null>(null);

  const [languageSupport, setLanguageSupport] = useState<Extension | null>(null);
  const [activeLineInfo, setActiveLineInfo] = useState<ActiveLineInfo | null>(null);
  const [editCommentInfo, setEditCommentInfo] = useState<EditCommentInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createNewTask, setCreateNewTask] = useState(false);
  const [confirmCloseTabPath, setConfirmCloseTabPath] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const activeFile = openFiles.find((file) => file.path === activeFilePath) ?? openFiles[openFiles.length - 1] ?? null;
  const activePath = activeFile?.path ?? null;
  const activePathRef = useRef<string | null>(null);
  activePathRef.current = activePath;
  const activeTab = activePath ? (tabsState[activePath] ?? null) : null;
  const activeFilePendingComments = useMemo(() => pendingComments.filter((c) => c.filePath === activePath), [pendingComments, activePath]);

  const isTabDirty = useCallback(
    (path: string) => {
      const tab = tabsState[path];
      return !!tab && tab.savedContent !== null && tab.editorContent !== null && tab.savedContent !== tab.editorContent;
    },
    [tabsState],
  );

  const dirtyPaths = useMemo(() => new Set(openFiles.filter((file) => isTabDirty(file.path)).map((file) => file.path)), [openFiles, isTabDirty]);
  const isDirty = activePath ? isTabDirty(activePath) : false;

  const setTabState = useCallback((path: string, tabState: TabState) => {
    tabsStateRef.current[path] = tabState;
    setTabsState((prev) => ({ ...prev, [path]: tabState }));
  }, []);

  useEffect(() => {
    const missing = openFiles.filter((file) => !tabsStateRef.current[file.path]);
    if (missing.length === 0) {
      return;
    }

    missing.forEach((file) => {
      setTabState(file.path, createInitialTabState(true));
    });

    const unavailablePaths: string[] = [];
    void Promise.all(
      missing.map(async (file) => {
        try {
          const fileContent = await api.readFile(baseDir, file.taskId, file.path);
          setTabState(file.path, {
            savedContent: fileContent,
            editorContent: fileContent,
            isLoading: false,
            error: null,
          });
        } catch {
          unavailablePaths.push(file.path);
        }
      }),
    ).then(() => {
      if (unavailablePaths.length > 0) {
        closeTabs(baseDir, unavailablePaths);
      }
    });
  }, [api, baseDir, openFiles, closeTabs, setTabState]);

  useEffect(() => {
    const fetchLanguageSupport = async () => {
      if (!activePath) {
        return;
      }
      setLanguageSupport(null);

      const language = LanguageDescription.matchFilename(languages, activePath);
      if (!language) {
        return;
      }
      try {
        const support = await language.load();
        if (activePathRef.current === activePath) {
          setLanguageSupport(support);
        }
      } catch {
        if (activePathRef.current === activePath) {
          setLanguageSupport(null);
        }
      }
    };

    void fetchLanguageSupport();
  }, [activePath]);

  useEffect(() => {
    setActiveLineInfo(null);
    setEditCommentInfo(null);
  }, [activePath]);

  const updatePendingComments = useCallback((updater: (comments: PendingComment[]) => PendingComment[]) => {
    const next = updater(pendingCommentsRef.current);
    pendingCommentsRef.current = next;
    setPendingComments(next);
  }, []);

  const handleLineSelect = useCallback<LineSelectHandler>((lineNumber, position, rect) => {
    setEditCommentInfo(null);
    setActiveLineInfo({
      lineNumber,
      position,
      viewportRect: {
        top: rect.bottom + 8,
        left: Math.min(rect.left + 8, window.innerWidth - 300),
      },
    });
  }, []);

  const changeRequestGutter = useMemo(
    () =>
      gutter({
        class: 'cm-change-request-gutter',
        renderEmptyElements: true,
        lineMarker: (view, line) => {
          const documentLine = view.state.doc.lineAt(line.from);
          return new ChangeRequestGutterMarker(documentLine.number, documentLine.from, t('fileEditor.requestChangeOnLine'), handleLineSelect);
        },
      }),
    [handleLineSelect, t],
  );

  const captureSelection = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet && !update.docChanged) {
          return;
        }
        const path = activePathRef.current;
        if (!path) {
          return;
        }
        const { anchor, head } = update.state.selection.main;
        const previous = tabViewStatesRef.current[path];
        tabViewStatesRef.current[path] = { anchor, head, scrollTop: previous?.scrollTop ?? 0 };
      }),
    [],
  );

  const handleCreateEditor = useCallback((view: EditorView) => {
    editorViewRef.current = view;

    const path = activePathRef.current;
    if (path) {
      const savedViewState = tabViewStatesRef.current[path];
      if (savedViewState) {
        const docLength = view.state.doc.length;
        view.dispatch({
          selection: {
            anchor: Math.min(savedViewState.anchor, docLength),
            head: Math.min(savedViewState.head, docLength),
          },
        });
        if (savedViewState.scrollTop > 0) {
          requestAnimationFrame(() => {
            view.scrollDOM.scrollTop = savedViewState.scrollTop;
          });
        }
      }
    }

    view.scrollDOM.addEventListener(
      'scroll',
      () => {
        const scrollPath = activePathRef.current;
        if (!scrollPath) {
          return;
        }
        const previous = tabViewStatesRef.current[scrollPath];
        tabViewStatesRef.current[scrollPath] = { ...(previous ?? { anchor: 0, head: 0 }), scrollTop: view.scrollDOM.scrollTop };
      },
      { passive: true },
    );

    view.focus();
  }, []);

  const handleEditorChange = useCallback(
    (value: string, viewUpdate: Parameters<NonNullable<ComponentProps<typeof CodeMirror>['onChange']>>[1]) => {
      const path = activePathRef.current;
      if (!path) {
        return;
      }

      const currentTab = tabsStateRef.current[path];
      if (!currentTab) {
        return;
      }

      setTabState(path, { ...currentTab, editorContent: value });

      if (!viewUpdate.docChanged) {
        return;
      }

      const getLineNumber = (position: number) => viewUpdate.state.doc.lineAt(Math.min(position, viewUpdate.state.doc.length)).number;
      const mapPosition = (position: number) => viewUpdate.changes.mapPos(position, 1);

      updatePendingComments((comments) => comments.map((c) => (c.filePath !== path ? c : remapLineAnchors([c], mapPosition, getLineNumber)[0])));
      setActiveLineInfo((current) => {
        if (!current) {
          return null;
        }
        return remapLineAnchors([current], mapPosition, getLineNumber)[0];
      });
    },
    [setTabState, updatePendingComments],
  );

  const handleCommentCancel = useCallback(() => {
    setActiveLineInfo(null);
  }, []);

  const handleCommentSubmit = useCallback(
    (comment: string) => {
      if (!activeLineInfo || !activePath) {
        return;
      }

      const newComment: PendingComment = {
        id: `${activePath}-${activeLineInfo.lineNumber}-${Date.now()}`,
        filePath: activePath,
        lineNumber: activeLineInfo.lineNumber,
        position: activeLineInfo.position,
        comment,
      };

      updatePendingComments((comments) => [...comments, newComment]);
      setActiveLineInfo(null);
    },
    [activeLineInfo, activePath, updatePendingComments],
  );

  const handleRemoveComment = useCallback(
    (id: string) => {
      updatePendingComments((comments) => comments.filter((comment) => comment.id !== id));
      setEditCommentInfo((current) => (current?.commentId === id ? null : current));
    },
    [updatePendingComments],
  );

  const handleUpdateComment = useCallback(
    (id: string, comment: string) => {
      updatePendingComments((comments) => comments.map((pendingComment) => (pendingComment.id === id ? { ...pendingComment, comment } : pendingComment)));
    },
    [updatePendingComments],
  );

  const handleInlineCommentEdit = useCallback((id: string, rect: DOMRect) => {
    const path = activePathRef.current;
    if (!path) {
      return;
    }
    const pendingComment = pendingCommentsRef.current.find((comment) => comment.id === id);
    if (!pendingComment) {
      return;
    }

    setActiveLineInfo(null);
    setEditCommentInfo({
      commentId: id,
      viewportRect: {
        top: rect.bottom + 8,
        left: Math.min(rect.left + 8, window.innerWidth - 300),
      },
      initialText: pendingComment.comment,
    });
  }, []);

  const handleEditCommentSubmit = useCallback(
    (comment: string) => {
      if (!editCommentInfo) {
        return;
      }

      handleUpdateComment(editCommentInfo.commentId, comment);
      setEditCommentInfo(null);
    },
    [editCommentInfo, handleUpdateComment],
  );

  const handleEditCommentCancel = useCallback(() => {
    setEditCommentInfo(null);
  }, []);

  const inlineChangeRequests = useMemo(
    () =>
      createInlineChangeRequestsExtension({
        changeRequests: activeFilePendingComments,
        editLabel: t('common.edit'),
        deleteLabel: t('common.delete'),
        onEdit: handleInlineCommentEdit,
        onRemove: handleRemoveComment,
      }),
    [handleInlineCommentEdit, handleRemoveComment, activeFilePendingComments, t],
  );

  const editorExtensions = useMemo(
    () => [changeRequestGutter, lineNumbers(), EDITOR_LAYOUT, captureSelection, inlineChangeRequests, ...(languageSupport ? [languageSupport] : [])],
    [changeRequestGutter, captureSelection, inlineChangeRequests, languageSupport],
  );

  const saveTab = useCallback(
    async (path: string) => {
      const file = openFiles.find((openFile) => openFile.path === path);
      const tab = tabsStateRef.current[path];
      if (!file || !tab || tab.savedContent === null || tab.editorContent === null || tab.savedContent === tab.editorContent) {
        return false;
      }

      try {
        await api.saveFile(baseDir, file.taskId, path, tab.editorContent);
        setTabState(path, { ...tab, savedContent: tab.editorContent });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showErrorNotification(t('fileEditor.errorSaving', { error: message }));
        return false;
      }
    },
    [api, baseDir, openFiles, setTabState, t],
  );

  const handleSave = useCallback(async () => {
    if (!activePath) {
      return;
    }
    if (await saveTab(activePath)) {
      showSuccessNotification(t('fileEditor.saved'));
    }
  }, [activePath, saveTab, t]);

  const handleSaveAll = useCallback(async () => {
    const savedCount = (await Promise.all(openFiles.map((file) => saveTab(file.path)))).filter(Boolean).length;
    if (savedCount > 0) {
      showSuccessNotification(t('fileEditor.savedAll', { count: savedCount }));
    }
  }, [openFiles, saveTab, t]);

  const handleSubmitAll = useCallback(async () => {
    if (pendingComments.length === 0 || isSubmitting) {
      return;
    }
    if (dirtyPaths.size > 0) {
      showWarningNotification(t('fileEditor.saveBeforeSubmitting'));
      return;
    }

    const commentsByTask = new Map<string, PendingComment[]>();
    for (const comment of pendingComments) {
      const file = openFiles.find((f) => f.path === comment.filePath);
      if (!file) {
        continue;
      }
      const existing = commentsByTask.get(file.taskId) ?? [];
      existing.push(comment);
      commentsByTask.set(file.taskId, existing);
    }

    setIsSubmitting(true);
    try {
      for (const [taskId, comments] of commentsByTask) {
        api.runCodeChangeRequests(
          baseDir,
          taskId,
          comments.map((comment) => ({
            filename: comment.filePath,
            lineNumber: comment.lineNumber,
            userComment: comment.comment,
          })),
          createNewTask,
        );
      }
      updatePendingComments(() => []);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showErrorNotification(t('fileEditor.errorSubmitting', { error: message }));
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingComments, openFiles, dirtyPaths, api, baseDir, createNewTask, isSubmitting, onClose, t, updatePendingComments]);

  const removeTabBuffers = useCallback(
    (path: string) => {
      delete tabsStateRef.current[path];
      delete tabViewStatesRef.current[path];
      updatePendingComments((comments) => comments.filter((c) => c.filePath !== path));
      setTabsState((prev) => {
        if (!(path in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[path];
        return next;
      });
    },
    [updatePendingComments],
  );

  const closeTabInternal = useCallback(
    (path: string) => {
      removeTabBuffers(path);
      closeTab(baseDir, path);
    },
    [baseDir, closeTab, removeTabBuffers],
  );

  const handleCloseTab = useCallback(
    (path: string) => {
      if (isTabDirty(path)) {
        setConfirmCloseTabPath(path);
        setShowDiscardConfirm(true);
        return;
      }
      closeTabInternal(path);
    },
    [closeTabInternal, isTabDirty],
  );

  const handleClose = useCallback(() => {
    if (dirtyPaths.size > 0) {
      setConfirmCloseTabPath(null);
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [dirtyPaths.size, onClose]);

  const handleDiscardChanges = useCallback(() => {
    setShowDiscardConfirm(false);
    if (confirmCloseTabPath) {
      closeTabInternal(confirmCloseTabPath);
      setConfirmCloseTabPath(null);
      return;
    }
    onClose();
  }, [closeTabInternal, confirmCloseTabPath, onClose]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardConfirm(false);
    setConfirmCloseTabPath(null);
  }, []);

  const handleCreateNewTaskChange = useCallback((value: boolean) => {
    setCreateNewTask(value);
  }, []);

  const cycleTab = useCallback(
    (direction: 1 | -1) => {
      if (openFiles.length < 2 || !activePath) {
        return;
      }
      const currentIndex = openFiles.findIndex((file) => file.path === activePath);
      const nextIndex = (currentIndex + direction + openFiles.length) % openFiles.length;
      setActiveFile(baseDir, openFiles[nextIndex].path);
    },
    [activePath, baseDir, openFiles, setActiveFile],
  );

  const handleEscape = useCallback(() => {
    setActiveLineInfo(null);
  }, []);

  useHotkeys('escape', handleEscape, {
    enabled: !!activeLineInfo,
    enableOnFormTags: true,
    enableOnContentEditable: true,
  });

  useHotkeys(
    ['ctrl+s', 'meta+s'],
    (event) => {
      event.preventDefault();
      handleSave();
    },
    {
      enabled: isDirty,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [handleSave, isDirty],
  );

  useHotkeys(
    ['ctrl+tab', 'meta+tab'],
    (event) => {
      event.preventDefault();
      cycleTab(1);
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [cycleTab],
  );

  useHotkeys(
    ['ctrl+shift+tab', 'meta+shift+tab'],
    (event) => {
      event.preventDefault();
      cycleTab(-1);
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [cycleTab],
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center h-full">
      <AiOutlineLoading3Quarters className="w-8 h-8 text-text-muted animate-spin" />
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <HiOutlineExclamation className="w-12 h-12 text-error" />
      <p className="text-text-secondary text-sm">{t('fileEditor.errorLoading')}</p>
      {activeTab?.error && <p className="text-text-muted text-xs font-mono max-w-md text-center">{activeTab.error}</p>}
    </div>
  );

  return (
    <ModalOverlayLayout title={t('fileEditor.title')} onClose={handleClose} closeOnEscape={!activeLineInfo && !editCommentInfo && !showDiscardConfirm}>
      <FileEditorTabs
        openFiles={openFiles}
        activeFilePath={activePath}
        dirtyPaths={dirtyPaths}
        onSelect={(path) => setActiveFile(baseDir, path)}
        onClose={handleCloseTab}
        actions={
          <>
            {dirtyPaths.size > 1 && (
              <Button onClick={handleSaveAll} size="xs" tooltip={t('fileEditor.saveAllTooltip')}>
                <MdLibraryAddCheck className="w-3.5 h-3.5" />
                <span>{t('fileEditor.saveAll')}</span>
              </Button>
            )}
            <Button onClick={handleSave} disabled={!isDirty} size="xs" tooltip={t('fileEditor.saveShortcut')}>
              <MdSave className="w-3.5 h-3.5" />
              <span>{t('common.save')}</span>
            </Button>
          </>
        }
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden bg-bg-code-block relative">
          {activeLineInfo && <DiffLineCommentPanel onSubmit={handleCommentSubmit} onCancel={handleCommentCancel} anchorRect={activeLineInfo.viewportRect} />}
          {editCommentInfo && (
            <DiffLineCommentPanel
              initialText={editCommentInfo.initialText}
              onSubmit={handleEditCommentSubmit}
              onCancel={handleEditCommentCancel}
              anchorRect={editCommentInfo.viewportRect}
            />
          )}
          {!activeFile && renderLoading()}
          {activeFile && activeTab?.isLoading && renderLoading()}
          {activeFile && activeTab && !activeTab.isLoading && activeTab.error && renderError()}
          {activeFile && activeTab && !activeTab.isLoading && !activeTab.error && activeTab.editorContent !== null && (
            <CodeMirror
              key={activePath}
              value={activeTab.editorContent}
              onChange={handleEditorChange}
              onCreateEditor={handleCreateEditor}
              theme={EDITOR_THEME}
              basicSetup={BASIC_SETUP}
              extensions={editorExtensions}
              indentWithTab={true}
              className="h-full text-xs"
            />
          )}
        </div>

        <CommentsPanel
          pendingComments={pendingComments}
          onRemoveComment={handleRemoveComment}
          onUpdateComment={handleUpdateComment}
          onSubmitAll={handleSubmitAll}
          isSubmitting={isSubmitting}
          createNewTask={createNewTask}
          onCreateNewTaskChange={handleCreateNewTaskChange}
        />
      </div>

      {showDiscardConfirm && (
        <ConfirmDialog
          title={t('fileEditor.discardTitle')}
          onConfirm={handleDiscardChanges}
          onCancel={handleDiscardCancel}
          confirmButtonText={t('fileEditor.discard')}
          confirmButtonColor="danger"
          closeOnEscape
        >
          <p className="text-sm text-text-primary">{t('fileEditor.discardMessage')}</p>
        </ConfirmDialog>
      )}
    </ModalOverlayLayout>
  );
};
