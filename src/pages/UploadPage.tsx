import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, ArrowLeft, RefreshCw, AlertCircle, Loader2, Clock, AlertTriangle, Eye, Check, Plus, Trash2, ExternalLink } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { resourceQuery, receiveFile, confirmFile, cancelUpload } from '@/utils/api';

const RETRY_INTERVAL = 3000;
const POLL_TIMEOUT_MS = 60_000; // 60s 总超时
const MAX_POLL_ERRORS = 999; // 大值，实际用时间超时
const SESSION_KEY = 'upload_page_state';
let idCounter = 0;
const nextId = () => String(++idCounter);

interface UploadItem {
  id: string;
  soNo: string;
  fileName: string;
  file: File | null;
  hblNo: string;
  canUpload: boolean;
  verifyStatus: 'idle' | 'verifying' | 'success' | 'error';
  verifyMsg: string;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  uploadMsg: string;
  parseStatus: number | null;
  parseStatusText: string;
  retrying: boolean;
  pollRetries: number;
}

const createItem = (): UploadItem => ({
  id: nextId(),
  soNo: '',
  fileName: '',
  file: null,
  hblNo: '',
  canUpload: false,
  verifyStatus: 'idle',
  verifyMsg: '',
  uploadStatus: 'idle',
  uploadMsg: '',
  parseStatus: null,
  parseStatusText: '',
  retrying: false,
  pollRetries: 0,
});

type GlobalStep = 'input' | 'processing';

// 从 sessionStorage 恢复状态
function loadSavedState(): { items: UploadItem[]; globalStep: GlobalStep } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    // File 对象无法序列化，恢复后需要用户重新选择文件
    return { items: parsed.items, globalStep: parsed.globalStep || 'input' };
  } catch {
    return null;
  }
}

export function UploadPage() {
  const navigate = useNavigate();
  const saved = loadSavedState();
  const [items, setItems] = useState<UploadItem[]>(saved ? saved.items : [createItem()]);
  const [globalStep, setGlobalStep] = useState<GlobalStep>(saved ? saved.globalStep : 'input');
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNewUploadConfirm, setShowNewUploadConfirm] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number>(0);
  const stepRef = useRef<GlobalStep>(globalStep);
  stepRef.current = globalStep;

  // 保存/清除 sessionStorage
  useEffect(() => {
    if (globalStep === 'processing') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ items, globalStep }));
    }
  }, [items, globalStep]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // 页面关闭时清理所有已上传但未确认的临时文件
  const uploadedSoNos = useRef<string[]>([]);
  useEffect(() => {
    uploadedSoNos.current = items
      .filter(i => i.uploadStatus === 'success')
      .map(i => i.soNo.trim())
      .filter(Boolean);
  }, [items]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      uploadedSoNos.current.forEach(so => cancelUpload(so));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (stepRef.current === 'input') {
        const soNos = items.filter(i => i.uploadStatus === 'success').map(i => i.soNo.trim()).filter(Boolean);
        soNos.forEach(so => cancelUpload(so));
      }
    };
  }, []);

  // processing 阶段轮询所有 SO 的解析状态
  useEffect(() => {
    if (globalStep !== 'processing') return;

    const pollAll = async () => {
      // 60s 总超时：停止轮询，标记未完成的为超时
      if (pollStartTimeRef.current > 0 && Date.now() - pollStartTimeRef.current >= POLL_TIMEOUT_MS) {
        setItems(prev => prev.map(it => {
          if (
            it.uploadStatus === 'success' &&
            it.soNo.trim() &&
            it.parseStatus !== 5 &&
            it.parseStatus !== 6
          ) {
            return { ...it, parseStatusText: '解析超时', pollRetries: MAX_POLL_ERRORS };
          }
          return it;
        }));
        return;
      }

      let allResolved = true;
      const updates: { id: string; patch: Partial<UploadItem> }[] = [];

      // 只轮询 uploadStatus=success 且 retrying=false 且 pollRetries < MAX_POLL_ERRORS 的条目
      const candidates = items.filter(it =>
        it.uploadStatus === 'success' &&
        it.soNo.trim() &&
        !it.retrying &&
        it.pollRetries < MAX_POLL_ERRORS
      );

      for (const item of candidates) {
        const isFinal = item.parseStatus === 5 || item.parseStatus === 6 || item.parseStatus === 9;
        if (!isFinal || item.pollRetries > 0) {
          // 未到终态，或之前有错误需要重试确认
        }
        if (isFinal && item.pollRetries === 0) continue; // 已到终态且无错误，跳过

        try {
          const response = await resourceQuery(item.soNo.trim());
          const status = response.data?.status;
          const statusText = response.data?.status_text || getStatusLabel(status);

          updates.push({
            id: item.id,
            patch: {
              parseStatus: status ?? null,
              parseStatusText: statusText,
              pollRetries: 0, // 成功则重置错误计数
            },
          });

          if (status !== 5 && status !== 6 && status !== 9) {
            allResolved = false;
          }
        } catch {
          const newRetries = (item.pollRetries || 0) + 1;
          updates.push({
            id: item.id,
            patch: { pollRetries: newRetries },
          });
          if (newRetries < MAX_POLL_ERRORS) {
            allResolved = false;
          }
        }
      }

      // 检查是否有未到终态的非 retrying 条目
      const hasPending = items.some(it => {
        if (it.uploadStatus !== 'success' || !it.soNo.trim() || it.retrying) return false;
        if (it.pollRetries >= MAX_POLL_ERRORS) return false;
        return it.parseStatus !== 5 && it.parseStatus !== 6 && it.parseStatus !== 9;
      });

      if (updates.length > 0) {
        setItems(prev => prev.map(it => {
          const upd = updates.find(u => u.id === it.id);
          return upd ? { ...it, ...upd.patch } : it;
        }));
      }

      if ((!allResolved || hasPending) && candidates.length > 0) {
        pollTimerRef.current = window.setTimeout(pollAll, RETRY_INTERVAL);
      }
    };

    pollTimerRef.current = window.setTimeout(pollAll, 500);
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [globalStep, items]);

  // --- Item operations ---
  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, createItem()]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(it => it.id !== id);
    });
  }, []);

  // 单条目重试：只重置该条目，不改变 globalStep，不影响其他条目
  const retrySingleItem = useCallback((id: string) => {
    setItems(prev => prev.map(it => it.id === id ? {
      ...it,
      file: null,
      fileName: '',
      canUpload: false,
      verifyStatus: 'idle' as const,
      verifyMsg: '',
      uploadStatus: 'idle' as const,
      uploadMsg: '',
      parseStatus: null,
      parseStatusText: '',
      retrying: true,
      pollRetries: 0,
    } : it));
  }, []);

  // Verify single SO
  const handleVerify = useCallback(async (id: string) => {
    const item = items.find(it => it.id === id);
    if (!item || !item.soNo.trim()) {
      updateItem(id, { verifyStatus: 'error', verifyMsg: '请填写 SO NO' });
      return;
    }
    updateItem(id, { verifyStatus: 'verifying', verifyMsg: '', canUpload: false });
    try {
      const response = await resourceQuery(item.soNo.trim());
      if (response.code === 0 && response.data) {
        if (response.data.can_upload) {
          updateItem(id, {
            verifyStatus: 'success',
            verifyMsg: response.data.message || '核验通过',
            canUpload: true,
            hblNo: response.data.hbl_no || '',
          });
        } else {
          updateItem(id, { verifyStatus: 'error', verifyMsg: response.data.message || '该 SO NO 不允许上传', canUpload: false });
        }
      } else {
        updateItem(id, { verifyStatus: 'error', verifyMsg: response.data?.message || response.msg || '核验失败', canUpload: false });
      }
    } catch {
      updateItem(id, { verifyStatus: 'error', verifyMsg: '网络请求失败', canUpload: false });
    }
  }, [items, updateItem]);

  // 上传单个条目
  const handleUploadSingle = useCallback(async (id: string) => {
    const item = items.find(it => it.id === id);
    if (!item || !item.file || !item.soNo.trim()) return;

    updateItem(id, { uploadStatus: 'uploading', uploadMsg: '' });
    try {
      const response = await receiveFile(
        [item.file],
        [item.soNo.trim()],
        item.hblNo ? [item.hblNo] : undefined,
      );
      if (response.code === 0) {
        updateItem(id, { uploadStatus: 'success', uploadMsg: '上传成功', fileName: item.file.name });
        return true;
      } else {
        updateItem(id, { uploadStatus: 'error', uploadMsg: response.data?.message || response.msg || '上传失败' });
        return false;
      }
    } catch {
      updateItem(id, { uploadStatus: 'error', uploadMsg: '网络请求失败' });
      return false;
    }
  }, [items, updateItem]);

  // 确认单个条目
  const handleConfirmSingle = useCallback(async (id: string) => {
    const item = items.find(it => it.id === id);
    if (!item || !item.soNo.trim()) return false;

    try {
      const response = await confirmFile(item.soNo.trim());
      if (response.code === 0) {
        updateItem(id, { retrying: false, pollRetries: 0 });
        return true;
      } else {
        updateItem(id, { uploadMsg: response.data?.message || response.msg || '确认失败' });
        return false;
      }
    } catch {
      updateItem(id, { uploadMsg: '确认请求失败' });
      return false;
    }
  }, [items, updateItem]);

  // Upload all verified items
  const handleUploadAll = useCallback(async () => {
    const verified = items.filter(it => it.canUpload && it.verifyStatus === 'success' && it.file);
    if (verified.length === 0) {
      setGlobalMessage({ type: 'error', text: '没有可上传的文件' });
      return;
    }

    setIsUploading(true);
    setGlobalMessage(null);

    verified.forEach(it => updateItem(it.id, { uploadStatus: 'uploading', uploadMsg: '' }));

    try {
      const response = await receiveFile(
        verified.map(it => it.file!),
        verified.map(it => it.soNo.trim()),
        verified.map(it => it.hblNo || '').filter(Boolean),
      );

      const msg = response.data?.message || response.msg || '';
      const isTempStored = msg.includes('暂存区') || msg.includes('确认上传');

      if (response.code === 0 || isTempStored) {
        verified.forEach(it => updateItem(it.id, {
          uploadStatus: 'success',
          uploadMsg: isTempStored ? msg : '上传成功',
          fileName: it.file?.name || it.fileName,
        }));
        setGlobalMessage({ type: 'success', text: isTempStored ? msg : '所有文件上传成功' });
      } else {
        verified.forEach(it => updateItem(it.id, { uploadStatus: 'error', uploadMsg: msg || '上传失败' }));
        setGlobalMessage({ type: 'error', text: msg || '上传失败' });
      }
    } catch {
      verified.forEach(it => updateItem(it.id, { uploadStatus: 'error', uploadMsg: '网络请求失败' }));
      setGlobalMessage({ type: 'error', text: '网络请求失败' });
    } finally {
      setIsUploading(false);
    }
  }, [items, updateItem]);

  // Confirm all uploaded items → enter processing
  const handleConfirmAction = useCallback(async () => {
    setShowConfirmModal(false);
    setIsConfirming(true);
    setGlobalMessage(null);

    const uploaded = items.filter(it => it.uploadStatus === 'success' && it.soNo.trim());
    let allOk = true;

    for (const item of uploaded) {
      try {
        const response = await confirmFile(item.soNo.trim());
        if (response.code !== 0) {
          allOk = false;
          updateItem(item.id, { uploadMsg: response.data?.message || response.msg || '确认失败' });
        }
      } catch {
        allOk = false;
      }
    }

    if (allOk) {
      pollStartTimeRef.current = Date.now();
      setGlobalStep('processing');
      setGlobalMessage({ type: 'success', text: '确认上传成功，等待解析完成...' });
    } else {
      setGlobalMessage({ type: 'error', text: '部分文件确认失败，请重试' });
    }
    setIsConfirming(false);
  }, [items, updateItem]);

  const handleNewUploadClick = useCallback(() => {
    // 有未审查的（包括待审查5和未完成），弹出确认；全部已审查6才直接重置
    const hasPending = items.some(
      it => it.uploadStatus === 'success' && it.parseStatus !== 6
    );
    if (hasPending) {
      setShowNewUploadConfirm(true);
    } else {

      pollStartTimeRef.current = 0;
        setItems([createItem()]);
      setGlobalStep('input');
      setGlobalMessage(null);
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [items]);

  const handleNewUploadConfirm = useCallback(() => {
    setShowNewUploadConfirm(false);
    pollStartTimeRef.current = 0;
    setItems([createItem()]);
    setGlobalStep('input');
    setGlobalMessage(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const handleReset = useCallback(() => {
    pollStartTimeRef.current = 0;
    setItems([createItem()]);
    setGlobalStep('input');
    setGlobalMessage(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  // 导航到审查页前保存状态，已审查的传 reviewed 标记
  const goToReview = useCallback((soNo: string, reviewed: boolean) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ items, globalStep }));
    navigate(`/review/${soNo}`, { state: { reviewed } });
  }, [items, globalStep, navigate]);

  const verifiedItems = items.filter(it => it.canUpload && it.verifyStatus === 'success');
  const allCanUpload = verifiedItems.length > 0 && verifiedItems.every(it => it.canUpload);
  const hasFiles = verifiedItems.some(it => it.file);
  // 只看核验通过的条目是否全部上传成功（忽略未核验或核验失败的条目）
  const allUploaded = verifiedItems.length > 0 && verifiedItems.every(it => it.uploadStatus === 'success');
  const hasUploadedSuccess = verifiedItems.some(it => it.uploadStatus === 'success');
  const anyUploadingOrUploaded = items.some(it => it.uploadStatus === 'uploading' || it.uploadStatus === 'success');

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">文件上传</h1>
          </div>

          {globalMessage && (
            <div className={`
              mb-6 px-4 py-3 rounded-lg flex items-center gap-2
              ${globalMessage.type === 'success' ? 'bg-green-100 text-green-700'
                : globalMessage.type === 'warning' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'}
            `}>
              {globalMessage.type === 'success' ? <CheckCircle className="w-5 h-5" />
                : globalMessage.type === 'warning' ? <Clock className="w-5 h-5" />
                : <AlertCircle className="w-5 h-5" />}
              <span>{globalMessage.text}</span>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-800">
                  {globalStep === 'processing' ? '解析进度' : '上传提单文件'}
                </h2>
              </div>
              {globalStep === 'input' && !anyUploadingOrUploaded && (
                <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> 添加 SO
                </button>
              )}
              {globalStep === 'processing' && (
                <button onClick={handleNewUploadClick} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> 上传新文件
                </button>
              )}
            </div>

            {/* ====== INPUT STEP ====== */}
            {globalStep === 'input' && (
              <div className="space-y-6">
                {items.map((item, idx) => (
                  <div key={item.id} className={`p-4 rounded-xl border ${item.uploadStatus === 'success' ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50/30'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-600">#{idx + 1}</span>
                      {items.length > 1 && item.uploadStatus !== 'success' && (
                        <button onClick={() => removeItem(item.id)} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* SO NO input + verify button */}
                    <div className="flex gap-3 mb-3">
                      <input
                        type="text"
                        value={item.soNo}
                        onChange={e => updateItem(item.id, { soNo: e.target.value, verifyStatus: 'idle', verifyMsg: '', canUpload: false })}
                        placeholder="请输入 SO NO"
                        disabled={item.verifyStatus === 'success' || item.uploadStatus === 'success'}
                        className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (item.verifyStatus === 'success' || item.uploadStatus === 'success') ? 'bg-gray-100 cursor-not-allowed border-gray-200' : 'border-gray-300'
                        }`}
                      />
                      <button
                        onClick={() => handleVerify(item.id)}
                        disabled={!item.soNo.trim() || item.verifyStatus === 'verifying' || item.verifyStatus === 'success' || item.uploadStatus === 'success'}
                        className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                          item.soNo.trim() && item.verifyStatus !== 'verifying' && item.verifyStatus !== 'success' && item.uploadStatus !== 'success'
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {item.verifyStatus === 'verifying' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        {item.verifyStatus === 'verifying' ? '核验中' : '核验'}
                      </button>
                    </div>

                    {item.verifyStatus === 'success' && (
                      <div className="flex items-center gap-1.5 mb-3 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" /> {item.verifyMsg}
                      </div>
                    )}
                    {item.verifyStatus === 'error' && (
                      <div className="flex items-center gap-1.5 mb-3 text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4" /> {item.verifyMsg}
                      </div>
                    )}

                    {/* File upload area */}
                    {item.canUpload && item.uploadStatus !== 'success' && (
                      <div
                        className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl cursor-pointer transition-colors py-8 ${
                          item.file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                        }`}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault();
                          const f = e.dataTransfer.files?.[0];
                          if (f) updateItem(item.id, { file: f, fileName: f.name });
                        }}
                        onClick={() => document.getElementById(`file-${item.id}`)?.click()}
                      >
                        <input
                          id={`file-${item.id}`}
                          type="file"
                          accept=".xlsx,.xls,.doc,.docx,.jpg,.png,.pdf,.gif"
                          onChange={e => { const f = e.target.files?.[0]; if (f) updateItem(item.id, { file: f, fileName: f.name }); }}
                          className="hidden"
                        />
                        <Upload className={`w-8 h-8 mb-2 ${item.file ? 'text-blue-500' : 'text-gray-400'}`} />
                        <p className="text-sm text-gray-600">{item.file ? `已选择: ${item.file.name}` : '点击或拖拽选择文件'}</p>
                        <p className="text-xs text-gray-400 mt-1">支持: xlsx, xls, doc, docx, jpg, png, pdf, gif</p>
                      </div>
                    )}

                    {item.uploadStatus === 'uploading' && (
                      <div className="flex items-center gap-2 mt-3 text-blue-600 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> 上传中...
                      </div>
                    )}
                    {item.uploadStatus === 'success' && (
                      <div className="flex items-center gap-2 mt-3 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" /> 已上传 {item.fileName && `(${item.fileName})`}
                      </div>
                    )}
                    {item.uploadStatus === 'error' && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-red-600 text-sm mb-2">
                          <AlertCircle className="w-4 h-4" /> {item.uploadMsg}
                        </div>
                        <button
                          onClick={() => updateItem(item.id, { uploadStatus: 'idle', uploadMsg: '' })}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> 重新上传此项
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Global action buttons */}
                {(allCanUpload && hasFiles && !hasUploadedSuccess) && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button onClick={handleReset} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                      重新核验
                    </button>
                    <button
                      onClick={handleUploadAll}
                      disabled={isUploading}
                      className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                        !isUploading ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <Upload className="w-5 h-5" />
                      {isUploading ? '上传中...' : '全部上传'}
                    </button>
                  </div>
                )}

                {hasUploadedSuccess && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button onClick={handleReset} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                      重新上传
                    </button>
                    <button
                      onClick={() => setShowConfirmModal(true)}
                      disabled={isConfirming}
                      className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                        !isConfirming ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-5 h-5" />
                      {isConfirming ? '确认中...' : '确认上传'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ====== PROCESSING STEP ====== */}
            {globalStep === 'processing' && (
              <div className="space-y-4">
                {items
                  .filter(it => it.uploadStatus === 'success' || it.retrying)
                  .map((item, idx) => {
                    const isCompleted = item.parseStatus === 5 || item.parseStatus === 6;
                    const isParseFailed = item.parseStatus === 9;
                    const isPending = item.parseStatus !== null && !isCompleted && !isParseFailed;
                    const isPollStuck = !item.retrying && item.pollRetries >= MAX_POLL_ERRORS;

                    // 单条目重试模式：显示內联上传控件
                    if (item.retrying) {
                      return (
                        <RetryItemCard
                          key={item.id}
                          item={item}
                          idx={idx}
                          onVerify={(id) => handleVerify(id)}
                          onUpload={(id) => handleUploadSingle(id)}
                          onConfirm={(id) => handleConfirmSingle(id)}
                          onCancel={(id) => updateItem(id, { retrying: false, uploadStatus: 'success', uploadMsg: '' })}
                          updateItem={updateItem}
                        />
                      );
                    }

                    return (
                      <div key={item.id} className={`p-4 rounded-xl border ${
                        isCompleted ? 'border-green-300 bg-green-50/40' :
                        isParseFailed ? 'border-red-300 bg-red-50/40' :
                        isPollStuck ? 'border-yellow-300 bg-yellow-50/40' :
                        'border-blue-200 bg-blue-50/30'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-600">#{idx + 1}</span>
                              <span className="text-sm font-mono text-gray-800">{item.soNo}</span>
                              {item.fileName && (
                                <span className="text-xs text-gray-400 truncate">({item.fileName})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isPollStuck && (
                                <>
                                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                  <span className="text-sm text-yellow-600">解析超时</span>
                                </>
                              )}
                              {isPending && (
                                <>
                                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                  <span className="text-sm text-blue-600">{item.parseStatusText || '处理中...'}</span>
                                </>
                              )}
                              {isCompleted && (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <span className="text-sm text-green-600">{item.parseStatusText}</span>
                                </>
                              )}
                              {isParseFailed && (
                                <>
                                  <AlertTriangle className="w-4 h-4 text-red-500" />
                                  <span className="text-sm text-red-600">{item.parseStatusText}</span>
                                </>
                              )}
                              {item.parseStatus === null && !isPollStuck && (
                                <>
                                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                  <span className="text-sm text-blue-600">正在查询解析状态...</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {item.parseStatus === 5 && (
                              <button
                                onClick={() => goToReview(item.soNo.trim(), false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                              >
                                <ExternalLink className="w-4 h-4" /> 去审查
                              </button>
                            )}
                            {item.parseStatus === 6 && (
                              <button
                                onClick={() => goToReview(item.soNo.trim(), true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
                              >
                                <ExternalLink className="w-4 h-4" /> 详情
                              </button>
                            )}
                            {(isParseFailed || isPollStuck) && (
                              <button
                                onClick={() => retrySingleItem(item.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                              >
                                <RefreshCw className="w-4 h-4" /> 重新上传
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="确认上传"
        message="确定要上传这些文件吗？"
        confirmText="确认上传"
        cancelText="取消"
        onConfirm={handleConfirmAction}
        onCancel={() => setShowConfirmModal(false)}
      />

      <ConfirmModal
        isOpen={showNewUploadConfirm}
        title="确认新上传"
        message="当前还有文件未审查完成，继续上传新文件将终止当前上传流程，确定要继续吗？"
        confirmText="继续上传"
        cancelText="取消"
        onConfirm={handleNewUploadConfirm}
        onCancel={() => setShowNewUploadConfirm(false)}
      />
    </>
  );
}

// ====== 单条目重试卡片（processing 阶段內联显示上传控件） ======
interface RetryItemCardProps {
  item: UploadItem;
  idx: number;
  onVerify: (id: string) => void;
  onUpload: (id: string) => Promise<boolean | undefined>;
  onConfirm: (id: string) => Promise<boolean>;
  onCancel: (id: string) => void;
  updateItem: (id: string, patch: Partial<UploadItem>) => void;
}

function RetryItemCard({ item, idx, onVerify, onUpload, onConfirm, onCancel, updateItem }: RetryItemCardProps) {
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [localMsg, setLocalMsg] = useState('');

  return (
    <div className={`p-4 rounded-xl border ${
      item.uploadStatus === 'success' ? 'border-green-200 bg-green-50/30' : 'border-orange-200 bg-orange-50/20'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">#{idx + 1}</span>
          <span className="text-sm font-mono text-gray-800">{item.soNo}</span>
          {item.fileName && <span className="text-xs text-gray-400">({item.fileName})</span>}
          <span className="text-xs text-orange-500 font-medium px-2 py-0.5 bg-orange-100 rounded">重新上传</span>
        </div>
        <button onClick={() => onCancel(item.id)} className="text-xs text-gray-400 hover:text-gray-600">
          取消
        </button>
      </div>

      {item.verifyStatus === 'idle' && (
        <button
          onClick={() => onVerify(item.id)}
          disabled={!item.soNo.trim()}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors ${
            item.soNo.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Eye className="w-4 h-4" /> 重新核验 SO
        </button>
      )}
      {item.verifyStatus === 'verifying' && (
        <div className="flex items-center gap-2 text-blue-600 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> 核验中...
        </div>
      )}
      {item.verifyStatus === 'success' && (
        <>
          <div className="flex items-center gap-1.5 mb-3 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" /> {item.verifyMsg}
          </div>
          {item.uploadStatus !== 'success' && (
            <>
              {item.canUpload && (
                <div
                  className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl cursor-pointer transition-colors py-6 mb-3 ${
                    item.file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) updateItem(item.id, { file: f, fileName: f.name });
                  }}
                  onClick={() => document.getElementById(`retry-file-${item.id}`)?.click()}
                >
                  <input
                    id={`retry-file-${item.id}`}
                    type="file"
                    accept=".xlsx,.xls,.doc,.docx,.jpg,.png,.pdf,.gif"
                    onChange={e => { const f = e.target.files?.[0]; if (f) updateItem(item.id, { file: f, fileName: f.name }); }}
                    className="hidden"
                  />
                  <Upload className={`w-6 h-6 mb-1 ${item.file ? 'text-blue-500' : 'text-gray-400'}`} />
                  <p className="text-sm text-gray-600">{item.file ? `已选择: ${item.file.name}` : '点击或拖拽选择文件'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">支持: xlsx, xls, doc, docx, jpg, png, pdf, gif</p>
                </div>
              )}
              {item.file && (
                <button
                  onClick={async () => {
                    setUploading(true);
                    setLocalMsg('');
                    const ok = await onUpload(item.id);
                    setUploading(false);
                    if (ok) {
                      setLocalMsg('上传成功，请点击确认');
                    }
                  }}
                  disabled={uploading}
                  className={`w-full py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                    !uploading ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? '上传中...' : '上传此项'}
                </button>
              )}
            </>
          )}

          {item.uploadStatus === 'uploading' && (
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> 上传中...
            </div>
          )}
          {item.uploadStatus === 'success' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" /> {item.uploadMsg}
              </div>
              <button
                onClick={async () => {
                  setConfirming(true);
                  setLocalMsg('');
                  const ok = await onConfirm(item.id);
                  setConfirming(false);
                  if (!ok) setLocalMsg('确认失败，请重试');
                }}
                disabled={confirming}
                className={`w-full py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                  !confirming ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                {confirming ? '确认中...' : '确认此项'}
              </button>
            </div>
          )}
          {item.uploadStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" /> {item.uploadMsg}
            </div>
          )}
          {localMsg && (
            <div className={`flex items-center gap-2 mt-2 text-sm ${localMsg.includes('失败') ? 'text-red-600' : 'text-green-600'}`}>
              {localMsg}
            </div>
          )}
        </>
      )}
      {item.verifyStatus === 'error' && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" /> {item.verifyMsg}
        </div>
      )}
    </div>
  );
}

function getStatusLabel(status: number | undefined): string {
  switch (status) {
    case 0: return '已上传';
    case 1: return '已接收';
    case 2: return '已确认待发送';
    case 3: return '已发送至解析处';
    case 4: return '已接收到成功的解析';
    case 5: return '已入库待审查';
    case 6: return '已审查';
    case 7: return '已转发下游';
    case 8: return '下游已接收';
    case 9: return '链路出现错误';
    default: return '处理中...';
  }
}
