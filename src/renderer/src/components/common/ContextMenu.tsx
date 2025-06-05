import { Menu, Item, useContextMenu, ItemParams, PredicateParams } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';

const CONTEXT_MENU_ID = 'aider-desk-context-menu';

// Define a type for the props passed to the context menu
// This will be populated by the event data from where the menu is triggered
interface ContextMenuTriggerProps {
  targetIsEditable: boolean;
  hasSelectedText: boolean;
}

export const ContextMenu: React.FC = () => {
  const handleItemClick = async ({ id, event, props }: ItemParams<ContextMenuTriggerProps>) => {
    // The 'event' here is the click event on the menu item, not the contextmenu event.
    // The 'props' are what we pass when calling show()
    const { targetIsEditable, hasSelectedText } = props || {};

    switch (id) {
      case 'copy':
        if (hasSelectedText) {
          const selectedText = window.getSelection()?.toString();
          if (selectedText) {
            try {
              await navigator.clipboard.writeText(selectedText);
              console.log('Text copied to clipboard:', selectedText);
            } catch (err) {
              console.error('Failed to copy text: ', err);
            }
          }
        }
        break;
      case 'paste':
        if (targetIsEditable) {
          try {
            const text = await navigator.clipboard.readText();
            const activeElement = document.activeElement;
            if (
              activeElement &&
              (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || (activeElement as HTMLElement).isContentEditable)
            ) {
              if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                const inputElement = activeElement as HTMLInputElement | HTMLTextAreaElement;
                const start = inputElement.selectionStart || 0;
                const end = inputElement.selectionEnd || 0;
                const currentValue = inputElement.value;
                inputElement.value = currentValue.substring(0, start) + text + currentValue.substring(end);
                inputElement.selectionStart = inputElement.selectionEnd = start + text.length;
                // Trigger input event to notify React of the change
                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                activeElement.dispatchEvent(inputEvent);
              } else if ((activeElement as HTMLElement).isContentEditable) {
                // For contentEditable elements, try to insert text at selection
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  selection.deleteFromDocument(); // Delete selected text if any
                  selection.getRangeAt(0).insertNode(document.createTextNode(text));
                  selection.collapseToEnd(); // Move cursor after inserted text

                  // Trigger input event to notify React of the change (if applicable for the framework)
                  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                  activeElement.dispatchEvent(inputEvent);
                }
              }
              console.log('Text pasted from clipboard:', text);
            } else {
              console.log('Paste is only supported in input/textarea elements or contentEditable elements that are active.');
            }
          } catch (err) {
            console.error('Failed to paste text: ', err);
          }
        }
        break;
    }
  };

  // Predicate function to determine if an item should be hidden
  const isCopyHidden = ({ props }: PredicateParams<ContextMenuTriggerProps>) => {
    return !props?.hasSelectedText;
  };

  const isPasteHidden = ({ props }: PredicateParams<ContextMenuTriggerProps>) => {
    return !props?.targetIsEditable;
  };

  return (
    <Menu id={CONTEXT_MENU_ID}>
      <Item id="copy" onClick={handleItemClick} hidden={isCopyHidden}>
        Copy
      </Item>
      <Item id="paste" onClick={handleItemClick} hidden={isPasteHidden}>
        Paste
      </Item>
    </Menu>
  );
};

// The useAiderDeskContextMenu hook remains the same,
// but the caller will need to provide the props when calling show().
export const useAiderDeskContextMenu = () => useContextMenu<ContextMenuTriggerProps>({ id: CONTEXT_MENU_ID });
