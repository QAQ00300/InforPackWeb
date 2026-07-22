import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isWarning = type === 'warning';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isWarning ? 'bg-yellow-100' : 'bg-red-100'}`}>
                <AlertTriangle className={`w-5 h-5 ${isWarning ? 'text-yellow-600' : 'text-red-600'}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-gray-600 mb-6">{message}</p>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors font-medium ${isWarning ? 'bg-yellow-500' : 'bg-red-500'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}