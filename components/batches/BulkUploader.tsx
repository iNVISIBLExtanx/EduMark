'use client';

import { useRef, useState, useCallback } from 'react';
import { apiUpload } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, X, Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 50;

interface FileEntry {
  id: string;
  file: File;
  studentName: string;
  indexNo: string;
  error?: string;
}

interface BulkUploaderProps {
  batchId: string;
  onUploadComplete: () => void;
}

export function BulkUploader({ batchId, onUploadComplete }: BulkUploaderProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles);
    const errors: string[] = [];
    const valid: FileEntry[] = [];

    if (files.length + incoming.length > MAX_FILES) {
      setUploadError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    for (const file of incoming) {
      if (file.type !== 'application/pdf') {
        errors.push(`${file.name}: not a PDF file`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 20MB limit`);
        continue;
      }
      const name = file.name.replace(/\.pdf$/i, '');
      valid.push({
        id: crypto.randomUUID(),
        file,
        studentName: name,
        indexNo: '',
      });
    }

    if (errors.length > 0) {
      setUploadError(errors.join('; '));
    } else {
      setUploadError(null);
    }

    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
    }
  }, [files.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateStudentName = (id: string, name: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, studentName: name } : f))
    );
  };

  const updateIndexNo = (id: string, indexNo: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, indexNo } : f))
    );
  };

  const allNamesValid = files.length > 0 && files.every((f) => f.studentName.trim().length > 0);

  const handleUpload = async () => {
    if (!allNamesValid) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    const metadata = {
      batch_id: batchId,
      files: files.map((f) => ({
        student_name: f.studentName.trim(),
        index_no: f.indexNo.trim() || undefined,
      })),
    };
    formData.append('metadata', JSON.stringify(metadata));
    files.forEach((f) => formData.append('files', f.file));

    try {
      await apiUpload('/api/submissions/upload', formData);
      setFiles([]);
      setUploadError(null);
      onUploadComplete();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Upload Student Papers</h2>

      <div
        data-testid="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop PDF files here, or
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf"
          className="hidden"
          onChange={handleInputChange}
          data-testid="file-input"
        />
        <p className="text-xs text-gray-400 mt-2">
          PDF only, max 20MB each, up to {MAX_FILES} files
        </p>
      </div>

      {uploadError && (
        <p className="text-sm text-red-600" data-testid="upload-error">
          {uploadError}
        </p>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </p>
          {files.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 rounded border p-2"
              data-testid="file-entry"
            >
              <span className="text-xs text-gray-500 truncate w-32 shrink-0">
                {entry.file.name}
              </span>
              <Input
                placeholder="Student name"
                value={entry.studentName}
                onChange={(e) => updateStudentName(entry.id, e.target.value)}
                className="flex-1"
                data-testid="student-name-input"
              />
              <Input
                placeholder="Index no."
                value={entry.indexNo}
                onChange={(e) => updateIndexNo(entry.id, e.target.value)}
                className="w-28"
                data-testid="index-no-input"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(entry.id)}
                data-testid="remove-file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            onClick={handleUpload}
            disabled={!allNamesValid || uploading}
            className="w-full"
            data-testid="upload-button"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading {files.length} file{files.length !== 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload All ({files.length})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
