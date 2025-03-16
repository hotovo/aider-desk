import { ContextFile } from '@common/types';
import React, { useEffect, useMemo, useState } from 'react';
import { StaticTreeDataProvider, Tree, UncontrolledTreeEnvironment } from 'react-complex-tree';
import { HiPlus, HiX } from 'react-icons/hi';
import { TbPencilOff } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';

import { StyledTooltip } from '../common/StyledTooltip';

import './ContextFiles.css';

interface TreeItem {
  index: string;
  isFolder: boolean;
  children: string[];
  data: string;
  file?: ContextFile;
}

const createFileTree = (files: ContextFile[]) => {
  const tree: Record<string, TreeItem> = {
    root: { index: 'root', children: [], isFolder: true, data: 'Root' },
  };

  files.forEach((file) => {
    const pathParts = file.path.split(/[\\/]/);

    let currentNode = tree.root;
    pathParts.forEach((part, partIndex) => {
      const isLastPart = partIndex === pathParts.length - 1;
      const nodeId = pathParts.slice(0, partIndex + 1).join('-');

      if (!tree[nodeId]) {
        tree[nodeId] = {
          index: nodeId,
          children: [],
          data: part,
          isFolder: !isLastPart,
          file: isLastPart ? file : undefined,
        };
        if (!currentNode.children) {
          currentNode.children = [];
        }
        currentNode.children.push(nodeId);
      }

      if (isLastPart) {
        tree[nodeId].data = part;
        tree[nodeId].isFolder = false;
      }

      currentNode = tree[nodeId];
    });
  });

  return tree;
};

type Props = {
  baseDir: string;
  showFileDialog: () => void;
};

export const ContextFiles = ({ baseDir, showFileDialog }: Props) => {
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [newlyAddedFiles, setNewlyAddedFiles] = useState<string[]>([]);

  const { t } = useTranslation();

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => a.path.localeCompare(b.path));
  }, [files]);

  useEffect(() => {
    const listenerId = window.api.addContextFilesUpdatedListener(baseDir, (_, { files: updatedFiles }) => {
      setFiles(updatedFiles);

      // Handle highlighting of new files
      const newFiles = updatedFiles.filter((file) => !files.some((f) => f.path === file.path));
      if (newFiles.length > 0) {
        setNewlyAddedFiles((prev) => [...prev, ...newFiles.map((f) => f.path)]);
        setTimeout(() => {
          setNewlyAddedFiles((prev) => prev.filter((path) => !newFiles.some((f) => f.path === path)));
        }, 2000);
      }
    });

    return () => {
      window.api.removeContextFilesUpdatedListener(listenerId);
    };
  }, [baseDir, files]);

  const treeData = useMemo(() => createFileTree(sortedFiles), [sortedFiles]);

  const dropFile = (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const file = (item as TreeItem).file;
    if (file) {
      window.api.dropFile(baseDir, file.path);
    }
  };

  return (
    <div className="flex-grow w-full p-2 space-y-2 overflow-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-900 scrollbar-rounded">
      <div className="flex flex-col">
        <div className="flex items-center mb-2">
          <h3 className="text-md font-semibold uppercase pl-1 flex-grow">{t('contextFiles.title')}</h3>
          <button
            onClick={showFileDialog}
            className="p-1 hover:bg-neutral-700 rounded-md"
            data-tooltip-id="add-file-tooltip"
            data-tooltip-content={t('contextFiles.add')}
          >
            <HiPlus className="w-5 h-5" />
          </button>
          <StyledTooltip id="add-file-tooltip" />
        </div>
        <div className="flex-grow w-full">
          <UncontrolledTreeEnvironment
            key={files.length}
            dataProvider={
              new StaticTreeDataProvider(treeData, (item) => ({
                ...item,
                canMove: false,
                canRename: false,
              }))
            }
            getItemTitle={(item) => item.data}
            renderItemTitle={({ title, item }) => {
              const isNewlyAdded = (item as TreeItem).file?.path && newlyAddedFiles.includes((item as TreeItem).file!.path);
              return <div className={`px-1 ${isNewlyAdded ? 'flash-highlight' : ''} flex items-center gap-1`}>{title}</div>;
            }}
            renderItemArrow={() => null}
            viewState={{
              ['contextFiles']: {
                expandedItems: Object.keys(treeData),
              },
            }}
            renderItem={({ item, title, children }) => (
              <>
                <div className="flex items-center justify-between w-full pr-2 min-h-5">
                  <div className="flex items-center">
                    <span className={`ml-1 text-xxs ${item.isFolder ? 'text-neutral-600' : 'text-neutral-100 font-semibold'}`}>{title}</span>
                  </div>
                  {!item.isFolder && (
                    <div className="flex items-center gap-1">
                      {(item as TreeItem).file?.readOnly && (
                        <>
                          <TbPencilOff
                            className="w-4 h-4 text-neutral-400"
                            data-tooltip-id={`readonly-file-tooltip-${(item as TreeItem).file?.path}`}
                            data-tooltip-content={t('contextFiles.readOnly')}
                          />
                          <StyledTooltip id={`readonly-file-tooltip-${(item as TreeItem).file?.path}`} />
                        </>
                      )}
                      <button onClick={dropFile(item as TreeItem)} className="px-1 py-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-red-800">
                        <HiX className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {children}
              </>
            )}
            canDragAndDrop={false}
            canDropOnFolder={false}
            canReorderItems={false}
          >
            <Tree treeId="contextFiles" rootItem="root" />
          </UncontrolledTreeEnvironment>
        </div>
      </div>
    </div>
  );
};
