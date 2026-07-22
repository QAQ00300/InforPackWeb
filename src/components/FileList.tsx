import { FileText, Trash2, CheckCircle, AlertCircle, Loader2, Pencil, XCircle, Clock } from 'lucide-react';
import { FileItem, formatFileSize, SoNoValidStatus } from '@/types';

interface FileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
  onUpdateSoNo: (id: string, so_no: string) => void;
  onSoNoBlur: (id: string) => void;
}

export function FileList({ files, onRemove, onUpdateSoNo, onSoNoBlur }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="mt-6 card">
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">暂无上传文件，请添加文件</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: FileItem['status']) => {
    switch (status) {
      case 'pending':
        return <span className="w-5 h-5 text-gray-400" />;
      case 'uploading':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <span className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: FileItem['status']) => {
    switch (status) {
      case 'pending':
        return '待上传';
      case 'uploading':
        return '上传中';
      case 'success':
        return '已上传';
      case 'failed':
        return '上传失败';
      default:
        return '未知';
    }
  };

  const getStatusColor = (status: FileItem['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'uploading':
        return 'text-blue-500';
      case 'success':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getSoNoValidIcon = (so_no_valid: SoNoValidStatus) => {
    switch (so_no_valid) {
      case 'empty':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'checking':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'valid':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'duplicate':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'confirmed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getSoNoValidText = (so_no_valid: SoNoValidStatus) => {
    switch (so_no_valid) {
      case 'empty':
        return '请输入 SO NO';
      case 'checking':
        return '检查中...';
      case 'valid':
        return '可用';
      case 'duplicate':
        return 'SO NO 已存在（可重新上传）';
      case 'confirmed':
        return 'SO NO 已确认，不可覆盖';
      default:
        return '';
    }
  };

  const getSoNoInputClass = (so_no_valid: SoNoValidStatus) => {
    switch (so_no_valid) {
      case 'empty':
        return 'border-red-300 bg-red-50 focus:border-red-500';
      case 'checking':
        return 'border-blue-300 bg-blue-50 focus:border-blue-500';
      case 'valid':
        return 'border-green-300 bg-green-50 focus:border-green-500';
      case 'duplicate':
        return 'border-orange-300 bg-orange-50 focus:border-orange-500';
      case 'confirmed':
        return 'border-red-300 bg-red-50 focus:border-red-500';
      default:
        return '';
    }
  };

  const getSoNoValidColor = (so_no_valid: SoNoValidStatus) => {
    switch (so_no_valid) {
      case 'empty':
        return 'text-red-500';
      case 'checking':
        return 'text-blue-500';
      case 'valid':
        return 'text-green-500';
      case 'duplicate':
        return 'text-orange-500';
      case 'confirmed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">已选择文件 ({files.length}/{20})</h3>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden md:grid md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500">
          <div className="w-8" />
          <div>文件名</div>
          <div className="text-center">SO NO</div>
          <div className="hidden md:block text-right">大小</div>
          <div className="hidden md:block text-center">状态</div>
          <div className="w-16" />
        </div>

        <div className="divide-y divide-gray-100">
          {files.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-gray-400" />
              </div>

              <div className="flex items-center min-w-0">
                <span className="truncate text-sm text-gray-700">
                  {file.file_name}
                </span>
              </div>

              <div className="flex items-center">
                <div className="relative flex items-center gap-2">
                  <input
                    type="text"
                    value={file.so_no}
                    onChange={(e) => onUpdateSoNo(file.id, e.target.value)}
                    onBlur={() => onSoNoBlur(file.id)}
                    placeholder="请输入 SO NO"
                    className={`
                      input-field w-full md:w-auto
                      ${getSoNoInputClass(file.so_no_valid)}
                    `}
                  />
                  {file.so_no && getSoNoValidIcon(file.so_no_valid)}
                </div>
              </div>

              <div className="hidden md:flex items-center justify-end">
                <span className="text-xs text-gray-500">
                  {formatFileSize(file.file_size)}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2">
                {getStatusIcon(file.status)}
                <span className={`text-xs ${getStatusColor(file.status)}`}>
                  {getStatusText(file.status)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                {file.status !== 'uploading' && (
                  <>
                    <button
                      onClick={() => {}}
                      className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRemove(file.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {(file.error_msg || file.so_no_valid !== 'valid') && (
                <div className="md:col-span-full mt-2 flex items-start gap-2 text-xs bg-gray-50 px-3 py-2 rounded-lg">
                  <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${getSoNoValidColor(file.so_no_valid)}`} />
                  <span className={getSoNoValidColor(file.so_no_valid)}>
                    {file.error_msg || getSoNoValidText(file.so_no_valid)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {files.some((f) => f.status === 'uploading') && (
          <div className="px-4 py-3 bg-blue-50">
            {files.map((file) => {
              if (file.status !== 'uploading') return null;
              return (
                <div key={file.id} className="mb-2 last:mb-0">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{file.file_name}</span>
                    <span>{file.progress || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress || 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}