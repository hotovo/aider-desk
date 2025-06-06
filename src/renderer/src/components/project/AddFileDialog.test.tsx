import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddFileDialog } from './AddFileDialog';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config'; // Assuming your i18n config is here

// Mocking electron API
global.window.api = {
  isValidPath: jest.fn(),
  isPathWithinBase: jest.fn(),
  getFilePathSuggestions: jest.fn().mockResolvedValue([]), // Mock for FileFinder
  // Add other API mocks if FileFinder or other children components need them
} as any;

// Mock FileChip as it's not relevant to these tests
jest.mock('@/components/common/FileChip', () => ({
  FileChip: ({ path, onRemove }: { path: string; onRemove: (p: string) => void }) => (
    <div data-testid={`file-chip-${path}`}>
      {path} <button onClick={() => onRemove(path)}>remove</button>
    </div>
  ),
}));

const mockOnClose = jest.fn();
const mockOnAddFiles = jest.fn();

const baseDir = '/project/base';

const renderComponent = (props: Partial<React.ComponentProps<typeof AddFileDialog>> = {}) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <AddFileDialog
        baseDir={baseDir}
        onClose={mockOnClose}
        onAddFiles={mockOnAddFiles}
        initialReadOnly={false}
        {...props}
      />
    </I18nextProvider>,
  );
};

describe('AddFileDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks for successful path validation
    (window.api.isValidPath as jest.Mock).mockResolvedValue(true);
    (window.api.isPathWithinBase as jest.Mock).mockResolvedValue(true);
  });

  it('renders correctly', () => {
    renderComponent();
    expect(screen.getByText('addFileDialog.title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.add' })).toBeDisabled(); // Initially no files
  });

  describe('File Drop', () => {
    const createFileMock = (path: string) => ({ path }); // Simplified file object for dataTransfer

    it('adds a file within baseDir and keeps readOnly false', async () => {
      renderComponent();
      const dropZone = screen.getByTestId('add-file-dialog-dropzone');
      const filePath = `${baseDir}/internal.txt`;

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [createFileMock(filePath)] },
      });

      await waitFor(() => {
        expect(screen.getByTestId(`file-chip-${filePath}`)).toBeInTheDocument();
      });
      expect(mockOnAddFiles).not.toHaveBeenCalled(); // Not called until confirm

      // Check Checkbox state
      const readOnlyCheckbox = screen.getByLabelText('addFileDialog.readOnly') as HTMLInputElement;
      expect(readOnlyCheckbox.checked).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
      expect(mockOnAddFiles).toHaveBeenCalledWith([filePath], false);
    });

    it('adds a file outside baseDir and sets readOnly true', async () => {
      (window.api.isPathWithinBase as jest.Mock).mockResolvedValue(false);
      renderComponent();
      const dropZone = screen.getByTestId('add-file-dialog-dropzone');
      const filePath = '/external/external.txt';

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [createFileMock(filePath)] },
      });

      await waitFor(() => {
        expect(screen.getByTestId(`file-chip-${filePath}`)).toBeInTheDocument();
      });

      const readOnlyCheckbox = screen.getByLabelText('addFileDialog.readOnly') as HTMLInputElement;
      expect(readOnlyCheckbox.checked).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
      expect(mockOnAddFiles).toHaveBeenCalledWith([filePath], true);
    });

    it('drops multiple files (one internal, one external) and sets readOnly true', async () => {
      const internalFile = `${baseDir}/internal.txt`;
      const externalFile = '/external/external.txt`;

      // Setup mocks: isPathWithinBase returns true for internal, false for external
      (window.api.isPathWithinBase as jest.Mock).mockImplementation(async (_base, p) => p === internalFile);

      renderComponent();
      const dropZone = screen.getByTestId('add-file-dialog-dropzone');

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [createFileMock(internalFile), createFileMock(externalFile)] },
      });

      await waitFor(() => {
        expect(screen.getByTestId(`file-chip-${internalFile}`)).toBeInTheDocument();
        expect(screen.getByTestId(`file-chip-${externalFile}`)).toBeInTheDocument();
      });

      const readOnlyCheckbox = screen.getByLabelText('addFileDialog.readOnly') as HTMLInputElement;
      expect(readOnlyCheckbox.checked).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
      expect(mockOnAddFiles).toHaveBeenCalledWith([internalFile, externalFile], true);
    });

    it('drops a file when initialReadOnly is true, keeps readOnly true', async () => {
      // isPathWithinBase returning true, but initialReadOnly should override
      (window.api.isPathWithinBase as jest.Mock).mockResolvedValue(true);
      renderComponent({ initialReadOnly: true });

      const dropZone = screen.getByTestId('add-file-dialog-dropzone');
      const filePath = `${baseDir}/internal.txt`;

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [createFileMock(filePath)] },
      });

      await waitFor(() => {
        expect(screen.getByTestId(`file-chip-${filePath}`)).toBeInTheDocument();
      });

      const readOnlyCheckbox = screen.getByLabelText('addFileDialog.readOnly') as HTMLInputElement;
      expect(readOnlyCheckbox.checked).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
      expect(mockOnAddFiles).toHaveBeenCalledWith([filePath], true);
    });
  });

  describe('File Paste', () => {
    // Assuming FileFinder's onPaste calls the provided onPaste prop correctly
    // We need to get the input element within FileFinder to simulate paste
    // For simplicity, let's assume FileFinder has an input with a specific testId or role

    it('pastes a file path within baseDir and keeps readOnly false', async () => {
      renderComponent();
      const filePath = `${baseDir}/internal-paste.txt`;

      // Simulate FileFinder's onPaste behavior by directly calling the handler
      // This requires finding the FileFinder's input or making its paste handler accessible
      // For this test, we'll assume a way to trigger FileFinder's onPaste
      // This might need adjustment based on FileFinder's actual implementation.
      // A more robust way would be to find the input and fireEvent.paste.
      // For now, let's find the input used by FileFinder (assuming it has one)
      const fileFinderInput = screen.getByRole('combobox'); // Based on typical FileFinder input

      fireEvent.paste(fileFinderInput, { clipboardData: { getData: () => filePath } });

      await waitFor(() => {
        expect(screen.getByTestId(`file-chip-${filePath}`)).toBeInTheDocument();
      });

      const readOnlyCheckbox = screen.getByLabelText('addFileDialog.readOnly') as HTMLInputElement;
      expect(readOnlyCheckbox.checked).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
      expect(mockOnAddFiles).toHaveBeenCalledWith([filePath], false);
    });

    it('pastes a file path outside baseDir and sets readOnly true', async () => {
      (window.api.isPathWithinBase as jest.Mock).mockResolvedValue(false);
      renderComponent();
      const filePath = `/external/external-paste.txt`;
      const fileFinderInput = screen.getByRole('combobox');

      fireEvent.paste(fileFinderInput, { clipboardData: { getData: () => filePath } });

      await waitFor(() => {
        expect(screen.getByTestId(`file-chip-${filePath}`)).toBeInTheDocument();
      });

      const readOnlyCheckbox = screen.getByLabelText('addFileDialog.readOnly') as HTMLInputElement;
      expect(readOnlyCheckbox.checked).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
      expect(mockOnAddFiles).toHaveBeenCalledWith([filePath], true);
    });
  });

  describe('Drag Events', () => {
    it('handles dragenter and changes border style', () => {
      renderComponent();
      const dropZone = screen.getByTestId('add-file-dialog-dropzone');

      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
      expect(dropZone.style.border).toBe('2px dashed #aaa');
    });

    it('handles dragover (preventDefault should be implicitly covered by drop working)', () => {
      // Difficult to directly test preventDefault without more complex event mocking.
      // If drop works, dragover's preventDefault is implicitly working.
      // We can ensure the border style remains if that's the behavior.
      renderComponent();
      const dropZone = screen.getByTestId('add-file-dialog-dropzone');
      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
      expect(dropZone.style.border).toBe('2px dashed #aaa');
      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
      expect(dropZone.style.border).toBe('2px dashed #aaa'); // Style should persist
    });

    it('handles dragleave and resets border style', () => {
      renderComponent();
      const dropZone = screen.getByTestId('add-file-dialog-dropzone');

      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
      expect(dropZone.style.border).toBe('2px dashed #aaa');

      fireEvent.dragLeave(dropZone);
      expect(dropZone.style.border).toBe('none');
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('disables add button when no files are selected', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: 'common.add' })).toBeDisabled();
  });

  it('enables add button when files are selected', async () => {
    renderComponent();
    const dropZone = screen.getByTestId('add-file-dialog-dropzone');
    const filePath = `${baseDir}/file.txt`;
    fireEvent.drop(dropZone, { dataTransfer: { files: [createFileMock(filePath)] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'common.add' })).not.toBeDisabled();
    });
  });

  it('removes a file when its remove button is clicked', async () => {
    renderComponent();
    const dropZone = screen.getByTestId('add-file-dialog-dropzone');
    const filePath1 = `${baseDir}/file1.txt`;
    const filePath2 = `${baseDir}/file2.txt`;

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [createFileMock(filePath1), createFileMock(filePath2)] },
    });

    await waitFor(() => {
      expect(screen.getByTestId(`file-chip-${filePath1}`)).toBeInTheDocument();
      expect(screen.getByTestId(`file-chip-${filePath2}`)).toBeInTheDocument();
    });

    const removeButton1 = within(screen.getByTestId(`file-chip-${filePath1}`)).getByRole('button', {name: 'remove'});
    fireEvent.click(removeButton1);

    await waitFor(() => {
      expect(screen.queryByTestId(`file-chip-${filePath1}`)).not.toBeInTheDocument();
    });
    expect(screen.getByTestId(`file-chip-${filePath2}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.add' })).not.toBeDisabled(); // Still one file left

    // Remove the second file
    const removeButton2 = within(screen.getByTestId(`file-chip-${filePath2}`)).getByRole('button', {name: 'remove'});
    fireEvent.click(removeButton2);

    await waitFor(() => {
      expect(screen.queryByTestId(`file-chip-${filePath2}`)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'common.add' })).toBeDisabled(); // No files left
  });
});

// Helper to use 'within' API
function within(element: HTMLElement) {
  return {
    getByRole: (role: string, options?: any) => screen.getByRole(element, role, options),
    // Add other queries if needed
  };
}

// Basic i18n setup for tests
const resources = {
  en: {
    translation: {
      "addFileDialog.title": "Add Files",
      "common.add": "Add",
      "common.cancel": "Cancel",
      "addFileDialog.readOnly": "Read-only",
      "fileFinder.placeholder": "Search or paste file paths...",
    }
  }
};

i18n.init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // react already safes from xss
  },
});
