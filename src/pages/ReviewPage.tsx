import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2, AlertCircle, Calendar, RefreshCw, Clock, RotateCcw } from 'lucide-react';
import { InfoSection } from '@/components/InfoSection';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getReviewDetail, updateReviewData, confirmReview } from '@/utils/api';
import { ReviewData, BasicInfo, TransportInfo, CargoInfo, OtherInfo, STATUS_MAP } from '@/types';

const initialBasicInfo: BasicInfo = {
  Shipper: '',
  Consignee: '',
  'NOTIFY PARTY': '',
  agent_at_destination: '',
  'ALSO NOTIFY': '',
  'EXPORT INSTRUCTION': '',
  remark: '',
};

const initialTransportInfo: TransportInfo = {
  pre_carriage: '',
  place_of_receipt: '',
  port_of_loading: '',
  port_of_discharge: '',
  place_of_delivery: '',
};

const initialCargoInfo: CargoInfo = {
  container_no: '',
  seal_no: '',
  marks: '',
  number: '',
  quantity: null,
  package_type: '',
  description: '',
  gross_weight_kg: null,
  measurement_cbm: null,
};

const initialOtherInfo: OtherInfo = {
  number_of_originals: null,
  payment_method: '',
  payment_place: '',
  service_mode: '',
  issue_place: '',
  issue_date: null,
};

const RETRY_INTERVAL = 3000;
const MAX_RETRY_COUNT = 20;

const InputField = memo(({
  label,
  value,
  onChange,
  placeholder = '',
  readOnly = false,
}: {
  label: string;
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  readOnly?: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 36)}px`;
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea
        ref={textareaRef}
        value={value ?? ''}
        title={String(value ?? '')}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val);
        }}
        placeholder={placeholder}
        readOnly={readOnly}
        rows={1}
        className={`input-field resize-none overflow-hidden ${readOnly ? 'bg-gray-50 cursor-not-allowed text-gray-500' : ''}`}
      />
    </div>
  );
});

const TextAreaField = memo(({
  label,
  value,
  onChange,
  placeholder = '',
  rows = 3,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, rows * 22)}px`;
    }
  }, [value, rows]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        rows={rows}
        className={`input-field resize-none overflow-hidden ${readOnly ? 'bg-gray-50 cursor-not-allowed text-gray-500' : ''}`}
      />
    </div>
  );
});

export function ReviewPage() {
  const { so_no } = useParams<{ so_no: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const reviewedFromUpload = (location.state as any)?.reviewed === true;
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState(5);
  const SESSION_KEY = 'upload_page_state';
  const statusRef = useRef(status);
  statusRef.current = status;

  const doNavigateBack = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.items) && so_no) {
          saved.items = saved.items.map((it: any) =>
            it.soNo === so_no ? { ...it, parseStatus: 6, parseStatusText: '已审查' } : it
          );
          saved.globalStep = 'processing';
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved));
        }
      }
    } catch {
      // ignore
    }
    navigate('/upload');
  }, [navigate, so_no]);

  const handleBackConfirm = useCallback(() => {
    setShowBackConfirm(false);
    doNavigateBack();
  }, [doNavigateBack]);

  // 返回上传页时，把当前 SO 标记为已审查（status=6）
  const goBackToUpload = useCallback(() => {
    // 详情模式（已审查）直接返回
    if (statusRef.current === 6) {
      doNavigateBack();
      return;
    }

    // 审查模式：检查是否有未审查的文件（与上传页"上传新文件"按钮逻辑一致）
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.items)) {
          const hasPending = saved.items.some(
            (it: any) => it.uploadStatus === 'success' && it.parseStatus !== 6
          );
          if (!hasPending) {
            doNavigateBack();
            return;
          }
        }
      }
    } catch {
      // ignore
    }
    setShowBackConfirm(true);
  }, [doNavigateBack]);
  const [reviewData, setReviewData] = useState<ReviewData>({
    hbl_no: '',
    so_no: '',
    basic_info: initialBasicInfo,
    transport_info: initialTransportInfo,
    cargo_info: initialCargoInfo,
    other_info: initialOtherInfo,
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [parseStatus, setParseStatus] = useState<'pending' | 'parsing' | 'completed' | 'failed'>('pending');
  const retryTimerRef = useRef<number | null>(null);
  const originalDataRef = useRef<ReviewData | null>(null);

  // 通过对比原始数据判断是否脏，避免额外 state 导致重渲染失焦
  const isDirty = originalDataRef.current
    ? JSON.stringify(originalDataRef.current) !== JSON.stringify(reviewData)
    : false;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setMessage(null);

      if (!so_no) {
        setLoading(false);
        setParseStatus('failed');
        setMessage({ type: 'error', text: '缺少 SO号 参数' });
        return;
      }

      try {
        const response = await getReviewDetail(so_no);

        if (response.code === 0 && response.data) {
          setReviewData(response.data);
          originalDataRef.current = response.data;
          // 兼容 status 在 response.data 或 response.data.data 中
          const data = response.data as any;
          const apiStatus: number = data?.status ?? data?.data?.status ?? 5;
          // 从"详情"按钮进来时，强制显示已审查
          setStatus(reviewedFromUpload ? 6 : apiStatus);
          setParseStatus('completed');
          setRetryCount(0);
        } else if (response.code === 1001) {
          setParseStatus('parsing');
          setMessage({
            type: 'warning',
            text: '系统正在解析文件，请稍候...',
          });
        } else {
          setParseStatus('failed');
          setMessage({ type: 'error', text: response.msg || '获取审查数据失败' });
        }
      } catch (error) {
        setParseStatus('failed');
        setMessage({ type: 'error', text: '网络异常，获取数据失败' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [so_no]);

  useEffect(() => {
    if (parseStatus === 'parsing' && retryCount < MAX_RETRY_COUNT) {
      retryTimerRef.current = window.setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        setLoading(true);

        getReviewDetail(so_no!)
          .then((response) => {
            if (response.code === 0 && response.data) {
              setReviewData(response.data);
              originalDataRef.current = response.data;
              setStatus(response.data.status || 5);
              setParseStatus('completed');
              setRetryCount(0);
              setMessage({
                type: 'success',
                text: '文件解析完成',
              });
            } else if (response.code === 1001) {
              setParseStatus('parsing');
            } else {
              setParseStatus('failed');
              setMessage({
                type: 'error',
                text: response.msg || '解析失败',
              });
            }
          })
          .catch(() => {
            setParseStatus('failed');
            setMessage({
              type: 'error',
              text: '网络异常，解析中断',
            });
          })
          .finally(() => {
            setLoading(false);
          });
      }, RETRY_INTERVAL);
    }

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [parseStatus, retryCount, so_no]);

  const handleRefresh = useCallback(() => {
    if (!so_no) return;
    setRetryCount(0);
    setLoading(true);
    setMessage(null);

    getReviewDetail(so_no)
      .then((response) => {
        if (response.code === 0 && response.data) {
          setReviewData(response.data);
          originalDataRef.current = response.data;
          // 兼容 status 在 response.data 或 response.data.data 中
          const data = response.data as any;
          const apiStatus: number = data?.status ?? data?.data?.status ?? 5;
          // 从"详情"按钮进来时，强制显示已审查
          setStatus(reviewedFromUpload ? 6 : apiStatus);
          setParseStatus('completed');
          setRetryCount(0);
          setMessage({
            type: 'success',
            text: '刷新成功',
          });
        } else if (response.code === 1001) {
          setParseStatus('parsing');
          setMessage({
            type: 'warning',
            text: '系统正在解析文件，请稍候...',
          });
        } else {
          setParseStatus('failed');
          setMessage({
            type: 'error',
            text: response.msg || '获取数据失败',
          });
        }
      })
      .catch(() => {
        setParseStatus('failed');
        setMessage({
          type: 'error',
          text: '刷新失败，请检查网络连接',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [so_no]);

  const handleInputChange = useCallback(<K extends keyof BasicInfo>(
    field: K,
    value: BasicInfo[K]
  ) => {
    setReviewData((prev) => ({
      ...prev,
      basic_info: { ...prev.basic_info, [field]: value },
    }));
  }, []);

  const handleTransportChange = useCallback(<K extends keyof TransportInfo>(
    field: K,
    value: TransportInfo[K]
  ) => {
    setReviewData((prev) => ({
      ...prev,
      transport_info: { ...prev.transport_info, [field]: value },
    }));
  }, []);

  const handleCargoChange = useCallback(<K extends keyof CargoInfo>(
    field: K,
    value: CargoInfo[K]
  ) => {
    setReviewData((prev) => ({
      ...prev,
      cargo_info: { ...prev.cargo_info, [field]: value },
    }));
  }, []);

  const handleOtherChange = useCallback(<K extends keyof OtherInfo>(
    field: K,
    value: OtherInfo[K]
  ) => {
    setReviewData((prev) => ({
      ...prev,
      other_info: { ...prev.other_info, [field]: value },
    }));
  }, []);

  const handleReset = useCallback(() => {
    if (originalDataRef.current) {
      setReviewData(originalDataRef.current);
      setMessage({ type: 'success', text: '已恢复至解析数据' });
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (!so_no) {
      setMessage({ type: 'error', text: '缺少必要参数' });
      return;
    }
    setShowConfirmModal(true);
  }, [so_no]);

  const handleConfirmAction = useCallback(async () => {
    if (!so_no) return;

    setShowConfirmModal(false);
    setConfirming(true);
    setMessage(null);

    try {
      // 有修改时先保存
      if (isDirty) {
        // 将 issue_date 从 "2026-06-29" 转为后端期望的 ISO 格式
        const transformedOtherInfo = {
          ...reviewData.other_info,
          issue_date: reviewData.other_info.issue_date
            ? new Date(reviewData.other_info.issue_date).toISOString()
            : null,
        };

        const saveResponse = await updateReviewData(so_no, {
          basic_info: reviewData.basic_info,
          transport_info: reviewData.transport_info,
          cargo_info: reviewData.cargo_info,
          other_info: transformedOtherInfo,
        });

        if (saveResponse.code !== 0) {
          setMessage({ type: 'error', text: saveResponse.msg || '保存失败' });
          setConfirming(false);
          return;
        }
      }

      // 确认转发
      const response = await confirmReview(so_no);

      if (response.code === 0) {
        setStatus(6);
        setMessage({
          type: 'success',
          text: response.msg || '确认信息成功',
        });
        // 确认成功后 1.5s 自动返回上传页面
        setTimeout(() => goBackToUpload(), 1500);
      } else {
        setMessage({
          type: 'error',
          text: response.msg || '确认失败',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: '确认失败，请检查网络连接',
      });
    } finally {
      setConfirming(false);
    }
  }, [so_no, reviewData, isDirty]);

  const LoadingState = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {retryCount + 1}
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">正在加载审查数据</h2>
          <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            {parseStatus === 'parsing'
              ? '系统正在解析文件，请稍候...'
              : '正在获取数据...'}
          </p>
          {retryCount > 0 && (
            <p className="text-gray-400 text-xs mt-2">
              已尝试 {retryCount} 次，最多尝试 {MAX_RETRY_COUNT} 次
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          手动刷新
        </button>
      </div>
    </div>
  );

  const ParsingFailedState = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full mx-4">
        <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">文件解析失败</h2>
          <p className="text-gray-500 text-sm">
            {message?.text || '系统无法解析该文件，请检查文件格式后重新上传'}
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => navigate('/upload')}
            className="flex-1 btn-secondary"
          >
            返回上传页面
          </button>
          <button
            onClick={handleRefresh}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            重新尝试
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <LoadingState />;
  }

  if (parseStatus === 'failed') {
    return <ParsingFailedState />;
  }

  const currentStatusInfo = STATUS_MAP[status];

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={goBackToUpload}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-800">审查确认</h1>
                  <StatusBadge statusCode={status} />
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded">SO号: {reviewData.so_no}</span>
                  </div>
                  {currentStatusInfo && (
                    <span>当前状态: {currentStatusInfo.label}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
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

          {status !== 5 && status !== 6 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-700">
                <p>当前状态为「{currentStatusInfo?.label || '未知'}」，不允许修改或确认操作。</p>
                <p className="mt-1">如需修改，请联系管理员处理。</p>
              </div>
            </div>
          )}

          <fieldset disabled={status === 6} className={status === 6 ? 'opacity-80 pointer-events-none' : ''}>
          <div className="card">
            <InfoSection title="基本信息">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <InputField
                      label="发货人"
                      value={reviewData.basic_info.Shipper}
                      onChange={(v) => handleInputChange('Shipper', v as string)}
                    />
                  </div>
                  <div className="flex-1">
                    <InputField
                      label="目的港代理方"
                      value={reviewData.basic_info.agent_at_destination}
                      onChange={(v) => handleInputChange('agent_at_destination', v as string)}
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <InputField
                      label="收货人"
                      value={reviewData.basic_info.Consignee}
                      onChange={(v) => handleInputChange('Consignee', v as string)}
                    />
                  </div>
                  <div className="flex-1">
                    <InputField
                      label="EXPORT INSTRUCTION"
                      value={reviewData.basic_info['EXPORT INSTRUCTION']}
                      onChange={(v) => handleInputChange('EXPORT INSTRUCTION', v as string)}
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <InputField
                      label="通知人"
                      value={reviewData.basic_info['NOTIFY PARTY']}
                      onChange={(v) => handleInputChange('NOTIFY PARTY', v as string)}
                    />
                  </div>
                  <div className="flex-1">
                    <InputField
                      label="ALSO NOTIFY"
                      value={reviewData.basic_info['ALSO NOTIFY']}
                      onChange={(v) => handleInputChange('ALSO NOTIFY', v as string)}
                    />
                  </div>
                </div>
                <TextAreaField
                  label="REMARK"
                  value={reviewData.basic_info.remark}
                  onChange={(v) => handleInputChange('remark', v)}
                />
              </div>
            </InfoSection>

            <InfoSection title="运输信息">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="驳船服务"
                  value={reviewData.transport_info.pre_carriage}
                  onChange={(v) => handleTransportChange('pre_carriage', v as string)}
                />
                <InputField
                  label="装货地"
                  value={reviewData.transport_info.place_of_receipt}
                  onChange={(v) => handleTransportChange('place_of_receipt', v as string)}
                />
                <InputField
                  label="起运港"
                  value={reviewData.transport_info.port_of_loading}
                  onChange={(v) => handleTransportChange('port_of_loading', v as string)}
                />
                <InputField
                  label="卸货港"
                  value={reviewData.transport_info.port_of_discharge}
                  onChange={(v) => handleTransportChange('port_of_discharge', v as string)}
                />
                <InputField
                  label="交货地"
                  value={reviewData.transport_info.place_of_delivery}
                  onChange={(v) => handleTransportChange('place_of_delivery', v as string)}
                />
              </div>
            </InfoSection>

            <InfoSection title="货物信息">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="CONTAINER"
                  value={reviewData.cargo_info.container_no}
                  onChange={(v) => handleCargoChange('container_no', v as string)}
                />
                <InputField
                  label="SEAL"
                  value={reviewData.cargo_info.seal_no}
                  onChange={(v) => handleCargoChange('seal_no', v as string)}
                />
                <InputField
                  label="MARKS"
                  value={reviewData.cargo_info.marks}
                  onChange={(v) => handleCargoChange('marks', v as string)}
                />
                <InputField
                  label="NUMBER"
                  value={reviewData.cargo_info.number}
                  onChange={(v) => handleCargoChange('number', v as string)}
                />
                <InputField
                  label="QUANTITY OF PACKAGES"
                  value={reviewData.cargo_info.quantity}
                  onChange={(v) => handleCargoChange('quantity', v as number | null)}
                />
                <InputField
                  label="KIND OF PACKAGES"
                  value={reviewData.cargo_info.package_type}
                  onChange={(v) => handleCargoChange('package_type', v as string)}
                />
                <div className="md:col-span-2">
                  <TextAreaField
                    label="DESCRIPTION OF GOODS"
                    value={reviewData.cargo_info.description}
                    onChange={(v) => handleCargoChange('description', v)}
                    rows={4}
                  />
                </div>
                <InputField
                  label="GROSS WEIGHT（KGS）"
                  value={reviewData.cargo_info.gross_weight_kg}
                  onChange={(v) => handleCargoChange('gross_weight_kg', v as number | null)}
                />
                <InputField
                  label="MEASUREMENT（CBM）"
                  value={reviewData.cargo_info.measurement_cbm}
                  onChange={(v) => handleCargoChange('measurement_cbm', v as number | null)}
                />
              </div>
            </InfoSection>

            <InfoSection title="其他信息">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="提单份数"
                  value={reviewData.other_info.number_of_originals}
                  onChange={(v) => handleOtherChange('number_of_originals', v as number | null)}
                />
                <InputField
                  label="HBL付款方式"
                  value={reviewData.other_info.payment_method}
                  onChange={(v) => handleOtherChange('payment_method', v as string)}
                />
                <InputField
                  label="HBL付款地点"
                  value={reviewData.other_info.payment_place}
                  onChange={(v) => handleOtherChange('payment_place', v as string)}
                />
                <InputField
                  label="转运条款"
                  value={reviewData.other_info.service_mode}
                  onChange={(v) => handleOtherChange('service_mode', v as string)}
                />
                <InputField
                  label="签发地点"
                  value={reviewData.other_info.issue_place}
                  onChange={(v) => handleOtherChange('issue_place', v as string)}
                />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    签发日期
                  </label>
                  <input
                    type="date"
                    value={reviewData.other_info.issue_date || ''}
                    onChange={(e) => handleOtherChange('issue_date', e.target.value || null)}
                    className={`input-field ${!reviewData.other_info.issue_date ? 'text-gray-300' : ''}`}
                  />
                </div>
              </div>
            </InfoSection>
          </div>

          <div className="mt-6 card">
            <div className="flex items-center justify-between gap-4">
              {status === 5 && (
                <button
                  onClick={handleReset}
                  disabled={!isDirty}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  恢复
                </button>
              )}
              {status === 6 && (
                <div />
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={handleConfirm}
                  disabled={confirming || status !== 5}
                  className={`btn-primary flex items-center gap-2 ${status !== 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <CheckCircle className="w-4 h-4" />
                  {confirming ? '确认中...' : '确认信息'}
                </button>
              </div>
            </div>

            {status === 5 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  提示：确认后数据将被保存并提交，请确保所有信息已核实无误。
                </p>
              </div>
            )}
          </div>
          </fieldset>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="确认信息"
        message="确认后将提交数据，确定要继续吗？"
        confirmText="确认信息"
        cancelText="取消"
        onConfirm={handleConfirmAction}
        onCancel={() => setShowConfirmModal(false)}
      />

      <ConfirmModal
        isOpen={showBackConfirm}
        title="返回上传页"
        message="当前还有未审查完成的文件，返回将终止本次审查流程，确定要继续吗？"
        confirmText="确定返回"
        cancelText="继续审查"
        onConfirm={handleBackConfirm}
        onCancel={() => setShowBackConfirm(false)}
      />
    </>
  );
}