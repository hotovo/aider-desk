import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '@/App'; // Assuming App integrates ContextMenu and its trigger
// import { ContextMenu, useAiderDeskContextMenu } from './ContextMenu'; // Not directly used if testing via App

// Mock navigator.clipboard
const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn(),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

// Mock window.getSelection
const mockGetSelection = jest.fn();
Object.defineProperty(window, 'getSelection', {
  value: mockGetSelection,
  writable: true,
});

// Helper to set up the App and ContextMenu for testing
// We will render the App component as it's responsible for triggering the context menu
// and the ContextMenu component itself is rendered within App.
const setup = () => {
  render(<App />); // Render the main App as it sets up the global context menu listener
};


describe('ContextMenu', () => {
  beforeEach(() => {
    // Clear mocks before each test
    mockClipboard.writeText.mockClear();
    mockClipboard.readText.mockClear();
    mockGetSelection.mockClear();
    // Reset document.activeElement
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Clean up any elements added to body during tests
    // This is important if tests add elements and don't clean them up properly,
    // though individual tests here do their own cleanup.
    document.body.innerHTML = '';
  });

  test('renders nothing initially when triggered in a non-relevant context', () => {
    setup();
    // The menu itself is rendered by App, but should not show items if not triggered appropriately.
    // Trigger a context menu event on a generic div
    const testDiv = document.createElement('div');
    document.body.appendChild(testDiv);
    mockGetSelection.mockReturnValue({ toString: () => '' }); // No text selected
    fireEvent.contextMenu(testDiv);

    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    expect(screen.queryByText('Paste')).not.toBeInTheDocument();
    document.body.removeChild(testDiv);
  });

  describe('Copy Action', () => {
    test('shows "Copy" when text is selected, and hides otherwise', async () => {
      setup();
      const testDiv = document.createElement('div');
      document.body.appendChild(testDiv);

      // Simulate no text selected and non-editable target
      mockGetSelection.mockReturnValue({ toString: () => '' });
      fireEvent.contextMenu(testDiv);
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();

      // Simulate text selected
      mockGetSelection.mockReturnValue({ toString: () => 'selected text' });
      fireEvent.contextMenu(testDiv);
      expect(screen.getByText('Copy')).toBeVisible(); // react-contexify might not immediately remove from DOM, check visibility

      // Hide menu by clicking away (simulated by react-contexify internals, or a click elsewhere)
      // For testing, we can trigger another context menu event in a non-copy context
      mockGetSelection.mockReturnValue({ toString: () => '' });
      fireEvent.contextMenu(document.body); // Trigger on body, no text, not editable
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();

      document.body.removeChild(testDiv);
    });

    test('"Copy" action copies selected text to clipboard', async () => {
      setup();
      const testDiv = document.createElement('div');
      document.body.appendChild(testDiv);
      mockGetSelection.mockReturnValue({ toString: () => 'test selection' });

      fireEvent.contextMenu(testDiv); // This should make "Copy" visible
      const copyButton = screen.getByText('Copy');

      // Using act for state updates and async operations
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith('test selection');
      document.body.removeChild(testDiv);
    });
  });

  describe('Paste Action', () => {
    test('shows "Paste" when an editable element is the target, and hides otherwise', async () => {
      setup();
      const nonEditableDiv = document.createElement('div');
      document.body.appendChild(nonEditableDiv);
      const inputElement = document.createElement('input');
      inputElement.type = 'text';
      document.body.appendChild(inputElement);

      // Target non-editable element
      mockGetSelection.mockReturnValue({ toString: () => '' }); // No text selected
      fireEvent.contextMenu(nonEditableDiv);
      expect(screen.queryByText('Paste')).not.toBeInTheDocument();

      // Target editable element (input)
      // Need to focus the input for it to be document.activeElement, which paste logic checks
      act(() => {
        inputElement.focus();
      });
      fireEvent.contextMenu(inputElement);
      expect(screen.getByText('Paste')).toBeVisible();

      // Hide menu
      mockGetSelection.mockReturnValue({ toString: () => '' });
      fireEvent.contextMenu(nonEditableDiv); // Trigger on non-editable, no text
      expect(screen.queryByText('Paste')).not.toBeInTheDocument();

      document.body.removeChild(nonEditableDiv);
      document.body.removeChild(inputElement);
    });

    test('"Paste" action pastes clipboard text into an editable input element', async () => {
      setup();
      const inputElement = document.createElement('input');
      inputElement.type = 'text';
      document.body.appendChild(inputElement);
      mockClipboard.readText.mockResolvedValue('pasted text');

      act(() => {
        inputElement.focus(); // Focus the input
      });
      fireEvent.contextMenu(inputElement); // Open context menu on the input

      const pasteButton = screen.getByText('Paste');
      await act(async () => {
        fireEvent.click(pasteButton);
      });

      expect(mockClipboard.readText).toHaveBeenCalled();
      expect(inputElement.value).toBe('pasted text');
      document.body.removeChild(inputElement);
    });

    test('"Paste" action pastes clipboard text into a contentEditable element', async () => {
        setup();
        const editableDiv = document.createElement('div');
        editableDiv.contentEditable = 'true';
        document.body.appendChild(editableDiv);
        mockClipboard.readText.mockResolvedValue('pasted text');

        act(() => {
            editableDiv.focus(); // Focus the div
        });
        fireEvent.contextMenu(editableDiv); // Open context menu on the div

        const pasteButton = screen.getByText('Paste');
        await act(async () => {
            fireEvent.click(pasteButton);
        });

        expect(mockClipboard.readText).toHaveBeenCalled();
        expect(editableDiv.textContent).toBe('pasted text');
        document.body.removeChild(editableDiv);
    });
  });

  test('menu does not show if no actions are available (no text selected, non-editable target)', () => {
    setup();
    const testDiv = document.createElement('div');
    document.body.appendChild(testDiv);

    mockGetSelection.mockReturnValue({ toString: () => '' }); // No text selected
    // Ensure target is not editable (a simple div by default)

    fireEvent.contextMenu(testDiv);

    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    expect(screen.queryByText('Paste')).not.toBeInTheDocument();
    document.body.removeChild(testDiv);
  });

  test('menu shows both "Copy" and "Paste" if text selected and target is editable', () => {
    setup();
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    document.body.appendChild(inputElement);

    mockGetSelection.mockReturnValue({ toString: () => 'selected text' });
    act(() => {
        inputElement.focus();
      });
    fireEvent.contextMenu(inputElement);

    expect(screen.getByText('Copy')).toBeVisible();
    expect(screen.getByText('Paste')).toBeVisible();

    document.body.removeChild(inputElement);
  });
});

// Note on setup:
// The tests rely on rendering the full <App /> because App.tsx contains the
// global contextmenu event listener that calls `show()` with the necessary props.
// If App.tsx becomes too complex or introduces side effects that interfere with these tests
// (e.g., routing, i18n, animations), a more minimal test setup would be required.
// This could involve creating a simplified `TestApp` component that replicates
// the necessary parts of App.tsx for context menu functionality, as commented
// in the initial prompt. For now, using the actual App is preferred to ensure
// the tests cover the true integration.
//
// Key dependencies for these tests to run:
// - Jest environment set up for React (jsdom)
// - @testing-library/react, @testing-library/jest-dom
// - ts-jest if using TypeScript
// - Mocking of CSS imports if not handled by Jest config (`identity-obj-proxy`)
// - Jest `moduleNameMapper` for path aliases like `@/`
// - `setupFilesAfterEnv` for `@testing-library/jest-dom`
//
// The provided code includes a `beforeEach` to clean up `document.body.innerHTML`.
// This is a robust way to ensure tests don't interfere with each other via DOM elements.
// Individual tests also clean up elements they append, which is good practice.
// The `act()` wrapper is used around operations that cause state updates or async logic
// to ensure tests wait for these updates to complete.
```
