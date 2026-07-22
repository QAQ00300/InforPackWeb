import { useState, useCallback, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { MAX_FILES, MAX_FILE_SIZE, ALLOWED_EXTENSIONS } from '@/types';
import { useUploadStore } from '@/store/uploadStore';

interface FileUploadAreaProps {
  onFilesAdded: (files: File[]) => void;
}

export function FileUploadArea({ onFilesAdded }: FileUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { files } = useUploadStore();

  const validateFiles = useCallback((newFiles: File[]): string | null => {
    const totalFiles = files.length + newFiles.length;
    if (totalFiles > MAX_FILES) {
      return `单次最多上传 ${MAX_FILES} 个文件`;
    }

    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return `${file.name} 超过大小限制（20MB）`;
      }

      const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return `${file.name} 格式不支持，支持的格式：${ALLOWED_EXTENSIONS.join(', ')}`;
      }
    }

    return null;
  }, [files.length]);

  const handleFiles = useCallback((selectedFiles: File[]) => {
    const validationError = validateFiles(selectedFiles);
    if (validationError) {
      setError(validationError);
      setTimeout(() => setError(null), 3000);
      return;
    }
    onFilesAdded(selectedFiles);
  }, [onFilesAdded, validateFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  }, [handleFiles]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      handleFiles(selectedFiles);
    }
    e.target.value = '';
  }, [handleFiles]);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
        transition-all duration-300
        ${isDragging
          ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-200'
          : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        accept={ALLOWED_EXTENSIONS.join(',')}
      />

      <div className="flex flex-col items-center gap-4">
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center
          transition-all duration-300
          ${isDragging ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'}
        `}>
          {isDragging ? <Upload className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
        </div>

        <div>
          <p className="text-lg font-medium text-gray-700 mb-1">
            {isDragging ? '释放文件以上传' : '拖拽文件到此处上传'}
          </p>
          <p className="text-sm text-gray-500">
            或点击选择文件
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center text-xs text-gray-400">
          <span>支持: .xlsx, .xls, .doc, .docx</span>
          <span>|</span>
          <span>.jpg, .png, .pdf, .gif</span>
          <span>|</span>
          <span>单个文件最大 20MB，最多上传 20 个</span>
        </div>
      </div>

      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}