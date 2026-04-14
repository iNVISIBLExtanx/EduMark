import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkUploader } from '@/components/batches/BulkUploader';

// Mock apiUpload
const mockApiUpload = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiUpload: (...args: unknown[]) => mockApiUpload(...args),
}));

// Mock shadcn components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Upload: () => <span data-testid="icon-upload" />,
  X: () => <span data-testid="icon-x" />,
  Loader2: () => <span data-testid="icon-loader" />,
}));

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

function createMockPdfFile(name: string, sizeMB = 1): File {
  const sizeBytes = sizeMB * 1024 * 1024;
  const content = new ArrayBuffer(sizeBytes);
  return new File([content], name, { type: 'application/pdf' });
}

function createMockNonPdfFile(name: string): File {
  return new File(['hello'], name, { type: 'text/plain' });
}

function createFileList(files: File[]): FileList {
  const fileList = Object.create(null);
  files.forEach((f, i) => { fileList[i] = f; });
  fileList.length = files.length;
  fileList.item = (i: number) => files[i] ?? null;
  fileList[Symbol.iterator] = function* () { for (const f of files) yield f; };
  return fileList as FileList;
}

const BATCH_ID = 'batch-123';

describe('BulkUploader', () => {
  const onUploadComplete = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    onUploadComplete.mockReset();
  });

  it('renders drop zone with correct text and browse button', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    expect(screen.getByText(/Drag and drop PDF files here, or/)).toBeInTheDocument();
    expect(screen.getByText('Browse files')).toBeInTheDocument();
    expect(screen.getByText('Upload Student Papers')).toBeInTheDocument();
    expect(screen.getByText(/PDF only, max 10MB each, up to 50 files/)).toBeInTheDocument();
  });

  it('adds files via file input and auto-populates student name from filename', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const file = createMockPdfFile('John Doe.pdf');
    fireEvent.change(input, { target: { files: createFileList([file]) } });

    const nameInputs = screen.getAllByTestId('student-name-input');
    expect(nameInputs[0]).toHaveValue('John Doe');
    expect(screen.getByText('John Doe.pdf')).toBeInTheDocument();
    expect(screen.getByText('1 file selected')).toBeInTheDocument();
  });

  it('shows plural text for multiple files', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const files = [createMockPdfFile('Alice.pdf'), createMockPdfFile('Bob.pdf')];
    fireEvent.change(input, { target: { files: createFileList(files) } });

    expect(screen.getByText('2 files selected')).toBeInTheDocument();
  });

  it('rejects non-PDF files with error message', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const file = createMockNonPdfFile('notes.txt');
    fireEvent.change(input, { target: { files: createFileList([file]) } });

    expect(screen.getByTestId('upload-error')).toHaveTextContent('notes.txt: not a PDF file');
    expect(screen.queryAllByTestId('file-entry')).toHaveLength(0);
  });

  it('rejects files over 10MB with error message', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const file = createMockPdfFile('big-file.pdf', 11);
    fireEvent.change(input, { target: { files: createFileList([file]) } });

    expect(screen.getByTestId('upload-error')).toHaveTextContent('big-file.pdf: exceeds 10MB limit (compress the PDF before uploading)');
    expect(screen.queryAllByTestId('file-entry')).toHaveLength(0);
  });

  it('shows combined error for mixed valid and invalid files', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const files = [
      createMockPdfFile('good.pdf'),
      createMockNonPdfFile('bad.txt'),
      createMockPdfFile('toobig.pdf', 25),
    ];
    fireEvent.change(input, { target: { files: createFileList(files) } });

    const errorEl = screen.getByTestId('upload-error');
    expect(errorEl).toHaveTextContent('bad.txt: not a PDF file');
    expect(errorEl).toHaveTextContent('toobig.pdf: exceeds 10MB limit (compress the PDF before uploading)');
    // The valid file should still be added
    expect(screen.getAllByTestId('file-entry')).toHaveLength(1);
    expect(screen.getByText('good.pdf')).toBeInTheDocument();
  });

  it('rejects when total files would exceed 50', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');

    // Add 48 files first
    const batch1: File[] = [];
    for (let i = 0; i < 48; i++) {
      batch1.push(createMockPdfFile(`student${i}.pdf`));
    }
    fireEvent.change(input, { target: { files: createFileList(batch1) } });
    expect(screen.getAllByTestId('file-entry')).toHaveLength(48);

    // Try to add 3 more (48 + 3 = 51 > 50)
    const batch2 = [
      createMockPdfFile('extra1.pdf'),
      createMockPdfFile('extra2.pdf'),
      createMockPdfFile('extra3.pdf'),
    ];
    fireEvent.change(input, { target: { files: createFileList(batch2) } });

    expect(screen.getByTestId('upload-error')).toHaveTextContent('Maximum 50 files allowed');
    // Should still be 48
    expect(screen.getAllByTestId('file-entry')).toHaveLength(48);
  });

  it('allows removing a file from the list', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const files = [createMockPdfFile('Alice.pdf'), createMockPdfFile('Bob.pdf')];
    fireEvent.change(input, { target: { files: createFileList(files) } });

    expect(screen.getAllByTestId('file-entry')).toHaveLength(2);

    const removeButtons = screen.getAllByTestId('remove-file');
    fireEvent.click(removeButtons[0]);

    expect(screen.getAllByTestId('file-entry')).toHaveLength(1);
    expect(screen.queryByText('Alice.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('Bob.pdf')).toBeInTheDocument();
  });

  it('allows editing student name', async () => {
    const user = userEvent.setup();
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Original.pdf')]) } });

    const nameInput = screen.getByTestId('student-name-input');
    expect(nameInput).toHaveValue('Original');

    await user.clear(nameInput);
    await user.type(nameInput, 'Edited Name');

    expect(nameInput).toHaveValue('Edited Name');
  });

  it('allows editing index number', async () => {
    const user = userEvent.setup();
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Student.pdf')]) } });

    const indexInput = screen.getByTestId('index-no-input');
    expect(indexInput).toHaveValue('');

    await user.type(indexInput, '12345');
    expect(indexInput).toHaveValue('12345');
  });

  it('disables upload button when a student name is empty', async () => {
    const user = userEvent.setup();
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Student.pdf')]) } });

    const uploadButton = screen.getByTestId('upload-button');
    expect(uploadButton).not.toBeDisabled();

    const nameInput = screen.getByTestId('student-name-input');
    await user.clear(nameInput);

    expect(uploadButton).toBeDisabled();
  });

  it('enables upload button when all files have student names', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const files = [createMockPdfFile('Alice.pdf'), createMockPdfFile('Bob.pdf')];
    fireEvent.change(input, { target: { files: createFileList(files) } });

    const uploadButton = screen.getByTestId('upload-button');
    expect(uploadButton).not.toBeDisabled();
  });

  it('does not show upload button when no files are selected', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);
    expect(screen.queryByTestId('upload-button')).not.toBeInTheDocument();
  });

  it('calls apiUpload with correct FormData on upload', async () => {
    mockApiUpload.mockResolvedValueOnce({ success: true });

    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const file1 = createMockPdfFile('Alice.pdf');
    const file2 = createMockPdfFile('Bob.pdf');
    fireEvent.change(input, { target: { files: createFileList([file1, file2]) } });

    const uploadButton = screen.getByTestId('upload-button');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(mockApiUpload).toHaveBeenCalledTimes(1);
    });

    const [url, formData] = mockApiUpload.mock.calls[0];
    expect(url).toBe('/api/submissions/upload');
    expect(formData).toBeInstanceOf(FormData);

    const metadata = JSON.parse(formData.get('metadata') as string);
    expect(metadata.batch_id).toBe(BATCH_ID);
    expect(metadata.files).toHaveLength(2);
    expect(metadata.files[0].student_name).toBe('Alice');
    expect(metadata.files[1].student_name).toBe('Bob');

    const uploadedFiles = formData.getAll('files');
    expect(uploadedFiles).toHaveLength(2);
  });

  it('includes index number in metadata when provided', async () => {
    const user = userEvent.setup();
    mockApiUpload.mockResolvedValueOnce({ success: true });

    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Student.pdf')]) } });

    const indexInput = screen.getByTestId('index-no-input');
    await user.type(indexInput, 'IDX001');

    const uploadButton = screen.getByTestId('upload-button');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(mockApiUpload).toHaveBeenCalledTimes(1);
    });

    const formData = mockApiUpload.mock.calls[0][1] as FormData;
    const metadata = JSON.parse(formData.get('metadata') as string);
    expect(metadata.files[0].index_no).toBe('IDX001');
  });

  it('omits index_no from metadata when not provided', async () => {
    mockApiUpload.mockResolvedValueOnce({ success: true });

    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Student.pdf')]) } });

    fireEvent.click(screen.getByTestId('upload-button'));

    await waitFor(() => {
      expect(mockApiUpload).toHaveBeenCalledTimes(1);
    });

    const formData = mockApiUpload.mock.calls[0][1] as FormData;
    const metadata = JSON.parse(formData.get('metadata') as string);
    expect(metadata.files[0].index_no).toBeUndefined();
  });

  it('shows spinner and disables button during upload', async () => {
    let resolveUpload: (v: unknown) => void;
    mockApiUpload.mockImplementation(() => new Promise((resolve) => { resolveUpload = resolve; }));

    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Student.pdf')]) } });

    const uploadButton = screen.getByTestId('upload-button');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
    });
    expect(uploadButton).toBeDisabled();
    expect(uploadButton).toHaveTextContent(/Uploading 1 file\.\.\./);

    resolveUpload!({ success: true });

    await waitFor(() => {
      expect(screen.queryByTestId('icon-loader')).not.toBeInTheDocument();
    });
  });

  it('calls onUploadComplete after successful upload', async () => {
    mockApiUpload.mockResolvedValueOnce({ success: true });

    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Student.pdf')]) } });

    fireEvent.click(screen.getByTestId('upload-button'));

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('clears file list after successful upload', async () => {
    mockApiUpload.mockResolvedValueOnce({ success: true });

    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Student.pdf')]) } });

    expect(screen.getAllByTestId('file-entry')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('upload-button'));

    await waitFor(() => {
      expect(screen.queryAllByTestId('file-entry')).toHaveLength(0);
    });
  });

  it('shows error message on upload failure', async () => {
    mockApiUpload.mockRejectedValueOnce(new Error('Network error'));

    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Student.pdf')]) } });

    fireEvent.click(screen.getByTestId('upload-button'));

    await waitFor(() => {
      expect(screen.getByTestId('upload-error')).toHaveTextContent('Network error');
    });
    expect(onUploadComplete).not.toHaveBeenCalled();
    // Files should still be present after failure
    expect(screen.getAllByTestId('file-entry')).toHaveLength(1);
  });

  it('shows fallback error message for non-Error rejection', async () => {
    mockApiUpload.mockRejectedValueOnce('string error');

    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: createFileList([createMockPdfFile('Student.pdf')]) } });

    fireEvent.click(screen.getByTestId('upload-button'));

    await waitFor(() => {
      expect(screen.getByTestId('upload-error')).toHaveTextContent('Upload failed');
    });
  });

  it('highlights drop zone on dragover and removes on dragleave', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const dropZone = screen.getByTestId('drop-zone');

    // Initial state: no blue highlight
    expect(dropZone.className).toContain('border-gray-300');
    expect(dropZone.className).not.toContain('border-blue-500');

    // Drag over: blue highlight
    fireEvent.dragOver(dropZone);
    expect(dropZone.className).toContain('border-blue-500');
    expect(dropZone.className).toContain('bg-blue-50');

    // Drag leave: back to gray
    fireEvent.dragLeave(dropZone);
    expect(dropZone.className).toContain('border-gray-300');
    expect(dropZone.className).not.toContain('border-blue-500');
  });

  it('accepts files via drag and drop', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const dropZone = screen.getByTestId('drop-zone');
    const file = createMockPdfFile('Dropped.pdf');

    fireEvent.drop(dropZone, {
      dataTransfer: { files: createFileList([file]) },
    });

    expect(screen.getAllByTestId('file-entry')).toHaveLength(1);
    expect(screen.getByText('Dropped.pdf')).toBeInTheDocument();
    const nameInput = screen.getByTestId('student-name-input');
    expect(nameInput).toHaveValue('Dropped');
    // Drag active should be reset after drop
    expect(dropZone.className).not.toContain('border-blue-500');
  });

  it('strips .pdf extension case-insensitively for student name', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const file = createMockPdfFile('Student Name.PDF');
    // Override the file name to have uppercase .PDF
    Object.defineProperty(file, 'name', { value: 'Student Name.PDF' });

    fireEvent.change(input, { target: { files: createFileList([file]) } });

    const nameInput = screen.getByTestId('student-name-input');
    expect(nameInput).toHaveValue('Student Name');
  });

  it('upload button shows correct text with file count', () => {
    render(<BulkUploader batchId={BATCH_ID} onUploadComplete={onUploadComplete} />);

    const input = screen.getByTestId('file-input');
    const files = [
      createMockPdfFile('A.pdf'),
      createMockPdfFile('B.pdf'),
      createMockPdfFile('C.pdf'),
    ];
    fireEvent.change(input, { target: { files: createFileList(files) } });

    const uploadButton = screen.getByTestId('upload-button');
    expect(uploadButton).toHaveTextContent('Upload All (3)');
  });
});
