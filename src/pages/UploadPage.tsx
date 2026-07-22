import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, ArrowLeft, RefreshCw, AlertCircle, Loader2, Clock, X, AlertTriangle, Eye, Check } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { resourceQuery, receiveFile, confirmFile, cancelUpload } from '@/utils/api';

const RETRY_INTERVAL = 3000;
const MAX_RETRY_COUNT = 20;

export function UploadPage() {
  const navigate = useNavigate();
  const [soNo, setSoNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [hblNo, setHblNo] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [step, setStep] = useState<'input' | 'verified' | 'uploaded' | 'parsing' | 'completed' | 'failed'>('input');
  const [canUpload, setCanUpload] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const stepRef = useRef(step);
  stepRef.current = step;
  const soNoRef = useRef(soNo);
  soNoRef.current = soNo;

  // 页面关闭/刷新时清理未确认的上传
  // 用 ref + 空依赖，确保只在真正卸载时触发，不会因 step 变化误触发
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (stepRef.current === 'uploaded' && soNoRef.current.trim()) {
        cancelUpload(soNoRef.current.trim());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (stepRef.current === 'uploaded' && soNoRef.current.trim()) {
        cancelUpload(soNoRef.current.trim());
      }
    };
  }, []);

  useEffect(() => {
    if (step === 'parsing' && retryCount < MAX_RETRY_COUNT) {
      retryTimerRef.current = window.setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        checkParseStatus();
      }, RETRY_INTERVAL);
    }
  }, [step, retryCount]);

  const checkParseStatus = useCallback(async () => {
    if (!soNo) return;

    try {
      const response = await resourceQuery(soNo);

      const data = response.data;
      const status = data?.status;
      
      // status 5/6 表示已入库待审查或已审查，解析完成
      if (status == 5 || status == 6) {
        setStep('completed');
        setMessage({ type: 'success', text: '文件解析成功' });
        setTimeout(() => navigate(`/review/${soNo}`), 1500);
      } else if (status == 9) {
        // 链路错误，停止轮询
        setStep('failed');
        setMessage({ type: 'error', text: '解析失败，' + (data?.status_text || '请联系管理员处理') });
      } else {
        setMessage({ type: 'warning', text: '系统正在解析文件，请稍候...' });
      }
    } catch (error) {
      setMessage({ type: 'warning', text: '系统正在解析文件，请稍候...' });
    }
  }, [soNo, navigate]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setMessage(null);
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setMessage(null);
  }, []);

  const handleVerify = useCallback(async () => {
    if (!soNo.trim()) {
      setMessage({ type: 'error', text: '请填写 SO NO' });
      return;
    }

    setIsVerifying(true);
    setMessage(null);

    try {
      const response = await resourceQuery(soNo.trim());

      if (response.code === 0 && response.data) {
        setCanUpload(response.data.can_upload);
        setHblNo(response.data.hbl_no || '');
        
        if (response.data.can_upload) {
          setStep('verified');
          setMessage({
            type: 'success',
            text: response.data.message || response.msg || '核验通过，可以上传文件',
          });
        } else {
          setStep('input');
          setMessage({
            type: 'error',
            text: response.data.message || response.msg || '该 SO NO 不允许上传',
          });
        }
      } else {
        setStep('input');
        setMessage({
          type: 'error',
          text: response.data?.message || response.msg || '核验失败',
        });
      }
    } catch (error) {
      setStep('input');
      setMessage({
        type: 'error',
        text: '网络请求失败，请检查网络连接',
      });
    } finally {
      setIsVerifying(false);
    }
  }, [soNo]);

  const handleUpload = useCallback(async () => {
    if (!file || !soNo.trim()) {
      setMessage({ type: 'error', text: '请选择文件' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const response = await receiveFile(file, soNo.trim(), hblNo || undefined);

      if (response.data?.hbl_no) {
        setHblNo(response.data.hbl_no);
      }

      setStep('uploaded');
      setMessage({
        type: response.code === 0 ? 'success' : 'warning',
        text: response.data?.message || response.msg || '文件上传成功',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: '网络请求失败，请检查网络连接',
      });
    } finally {
      setIsUploading(false);
    }
  }, [file, soNo, hblNo]);

  const handleConfirm = useCallback(() => {
    if (!soNo.trim()) return;
    setShowConfirmModal(true);
  }, [soNo]);

  const handleConfirmAction = useCallback(async () => {
    if (!soNo.trim()) return;

    setShowConfirmModal(false);
    setIsConfirming(true);
    setMessage(null);

    try {
      const response = await confirmFile(soNo.trim(), hblNo || undefined);

      if (response.code === 0) {
        setStep('parsing');
        setRetryCount(0);
        setMessage({
          type: 'success',
          text: response.data?.message || response.msg || '确认上传成功，正在解析文件...',
        });
      } else {
        setMessage({
          type: 'error',
          text: response.data?.message || response.msg || '操作失败',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: '网络请求失败，请检查网络连接',
      });
    } finally {
      setIsConfirming(false);
    }
  }, [soNo, hblNo]);

  const handleRefreshParse = useCallback(() => {
    setRetryCount(0);
    setMessage({ type: 'warning', text: '正在重新检查解析状态...' });
  }, []);

  const handleReset = useCallback(() => {
    setFile(null);
    setSoNo('');
    setHblNo('');
    setStep('input');
    setCanUpload(false);
    setRetryCount(0);
    setMessage(null);
  }, []);

  const isReadyToVerify = soNo.trim();
  const isReadyToUpload = step === 'verified' && file && soNo.trim();
  const isReadyToConfirm = step === 'uploaded' && soNo.trim();

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">文件上传</h1>
          </div>

          {message && (
            <div className={`
              mb-6 px-4 py-3 rounded-lg flex items-center gap-2
              ${message.type === 'success' ? 'bg-green-100 text-green-700' : message.type === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}
            `}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : message.type === 'warning' ? (
                <Clock className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <div className="card">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-800">上传提单文件</h2>
            </div>

            {(step === 'input' || step === 'verified') && (
              <div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">SO NO <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={soNo}
                    onChange={(e) => {
                      setSoNo(e.target.value);
                      if (step === 'verified') {
                        setStep('input');
                        setCanUpload(false);
                        setFile(null);
                      }
                    }}
                    placeholder="请输入 SO NO"
                    disabled={step === 'verified'}
                    className={`
                      w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${step === 'verified' ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'}
                    `}
                  />
                </div>

                <button
                  onClick={handleVerify}
                  disabled={isVerifying || !isReadyToVerify || step === 'verified'}
                  className={`
                    w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors
                    ${isReadyToVerify && !isVerifying && step !== 'verified'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <Eye className="w-5 h-5" />
                  {isVerifying ? '核验中...' : '核验'}
                </button>

                {step === 'verified' && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    {canUpload ? (
                      <>
                        <label
                          className={`
                            flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                            ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
                          `}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        >
                          <input
                            type="file"
                            accept=".xlsx,.xls,.doc,.docx,.jpg,.png,.pdf,.gif"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className={`w-10 h-10 mb-3 ${file ? 'text-blue-500' : 'text-gray-400'}`} />
                            <p className="mb-1 text-sm text-gray-600">
                              {file ? '点击或拖拽更换文件' : '拖拽文件到此处上传'}
                            </p>
                            <p className="text-xs text-gray-400">
                              支持: .xlsx, .xls, .doc, .docx | .jpg, .png, .pdf, .gif
                            </p>
                          </div>
                        </label>

                        {file && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-blue-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-800">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <button
                              onClick={handleRemoveFile}
                              className="p-2 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        )}

                        <button
                          onClick={handleUpload}
                          disabled={isUploading || !isReadyToUpload}
                          className={`
                            w-full mt-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors
                            ${isReadyToUpload && !isUploading
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }
                          `}
                        >
                          <Upload className="w-5 h-5" />
                          {isUploading ? '上传中...' : '上传文件'}
                        </button>

                        <button
                          onClick={handleReset}
                          className="w-full mt-3 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                          重新核验
                        </button>
                      </>
                    ) : (
                      <div className="p-6 bg-red-50 rounded-xl text-center">
                        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <p className="text-red-700 font-medium">该 SO NO 不允许上传</p>
                        <p className="text-red-600 text-sm mt-2">
                          可能是该 SO NO 已存在且状态不允许重复上传
                        </p>
                        <button
                          onClick={handleReset}
                          className="mt-4 px-6 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          返回重新输入
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 'uploaded' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">文件上传成功</h3>
                <p className="text-gray-500 text-sm">文件已保存到临时目录，等待确认上传</p>
                
                <div className="mt-4 space-y-2 text-left">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">文件名</span>
                    <span className="text-sm font-medium text-gray-800">{file?.name}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">SO NO</span>
                    <span className="text-sm font-medium text-gray-800 font-mono">{soNo}</span>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    重新上传
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isConfirming || !isReadyToConfirm}
                    className={`
                      flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors
                      ${isReadyToConfirm && !isConfirming
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    <Check className="w-5 h-5" />
                    {isConfirming ? '确认中...' : '确认上传'}
                  </button>
                </div>
              </div>
            )}

            {step === 'parsing' && (
              <div className="text-center py-8">
                <div className="relative inline-block">
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {retryCount + 1}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mt-4">正在解析文件</h3>
                <p className="text-gray-500 text-sm mt-2 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  系统正在解析您上传的文件，请稍候...
                </p>
                {retryCount > 0 && (
                  <p className="text-gray-400 text-xs mt-2">
                    已尝试 {retryCount} 次，最多尝试 {MAX_RETRY_COUNT} 次
                  </p>
                )}
                <button
                  onClick={handleRefreshParse}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  手动刷新
                </button>
              </div>
            )}

            {step === 'failed' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mt-4">操作失败</h3>
                <p className="text-gray-500 text-sm mt-2">
                  {message?.text || '系统处理失败，请稍后重试'}
                </p>
                <button
                  onClick={handleReset}
                  className="mt-4 flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  重新上传
                </button>
              </div>
            )}

            {step === 'completed' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mt-4">文件解析成功</h3>
                <p className="text-gray-500 text-sm mt-2">正在跳转到审查页面...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="确认上传"
        message="确定要上传此文件吗？"
        confirmText="确认上传"
        cancelText="取消"
        onConfirm={handleConfirmAction}
        onCancel={() => setShowConfirmModal(false)}
      />
    </>
  );
}