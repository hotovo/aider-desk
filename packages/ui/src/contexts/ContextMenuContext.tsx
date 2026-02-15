import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenuParams } from '@aider-desk/common/api';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useApi } from '@/contexts/ApiContext';

type ContextMenuContextType = {
  showMenu: (x: number, y: number, options: MenuOption[], targetElement?: Element | null) => void;
  hideMenu: () => void;
};

export const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export type MenuOption = {
  label: string;
  action: () => void;
  disabled?: boolean;
};

type MenuState = {
  x: number;
  y: number;
  isVisible: boolean;
  options: MenuOption[];
  targetElement?: Element | null;
};

type Props = {
  children: ReactNode;
};

export const ContextMenuProvider = ({ children }: Props) => {
  const [menuState, setMenuState] = useState<MenuState>({
    x: 0,
    y: 0,
    isVisible: false,
    options: [],
  });
  const menuRef = useRef<HTMLDivElement>(null);

  const showMenu = useCallback((x: number, y: number, options: MenuOption[], targetElement?: Element | null) => {
    setMenuState({ x, y, isVisible: true, options, targetElement });
  }, []);

  const hideMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isVisible: false, targetElement: undefined }));
  }, []);

  useClickOutside(menuRef, hideMenu);

  return (
    <ContextMenuContext.Provider value={{ showMenu, hideMenu }}>
      {children}
      {menuState.isVisible && (
        <div
          ref={menuRef}
          className="fixed bg-bg-secondary-light pb-0.5 shadow-2xl rounded-sm border border-border-default-dark z-50 min-w-[100px]"
          style={{
            top: menuState.y,
            left: menuState.x,
          }}
          onClick={hideMenu}
        >
          <ul className="list-none m-0 p-0">
            {menuState.options.map((option, index) => (
              <li key={index}>
                <button
                  onClick={option.action}
                  disabled={option.disabled}
                  className="w-full text-left px-4 py-0.5 text-xs text-text-primary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ContextMenuContext.Provider>
  );
};

export const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  const { t } = useTranslation();
  const api = useApi();
  if (context === undefined) {
    throw new Error('useContextMenu must be used within a ContextMenuProvider');
  }

  useEffect(() => {
    const handleContextMenu = (params: ContextMenuParams) => {
      const { x, y, selectionText, isEditable } = params;

      // Capture the target element when context menu is triggered
      const targetElement = document.elementFromPoint(x, y);

      const options: MenuOption[] = [];

      // Always show copy option
      options.push({
        label: t('contextMenu.copy'),
        action: async () => {
          try {
            // If there's selected text, copy that
            if (selectionText) {
              await api.writeToClipboard(selectionText);
            } else {
              // Otherwise, use the stored target element
              if (targetElement) {
                let textToCopy = '';

                // Handle input elements
                if (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement) {
                  textToCopy = targetElement.value;
                }
                // Handle other elements with text content
                else if (targetElement.textContent) {
                  textToCopy = targetElement.textContent.trim();
                }

                if (textToCopy) {
                  await api.writeToClipboard(textToCopy);
                }
              }
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to copy to clipboard:', error);
          }
        },
      });
      if (isEditable) {
        options.push({
          label: t('contextMenu.paste'),
          action: async () => {
            const text = await navigator.clipboard.readText();
            document.execCommand('insertText', false, text);
          },
        });
      }

      if (options.length > 0) {
        context.showMenu(x, y, options, targetElement);
      }
    };

    return api.addContextMenuListener(handleContextMenu);
  }, [context, t, api]);

  return context;
};
