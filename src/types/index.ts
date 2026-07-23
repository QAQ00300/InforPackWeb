export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
  errors?: string[];
}

export interface BasicInfo {
  Shipper: string;
  Consignee: string;
  "NOTIFY PARTY": string;
  agent_at_destination: string;
  "ALSO NOTIFY": string;
  "EXPORT INSTRUCTION": string;
  remark: string;
}

export interface TransportInfo {
  pre_carriage: string;
  place_of_receipt: string;
  port_of_loading: string;
  port_of_discharge: string;
  place_of_delivery: string;
}

export interface CargoInfo {
  container_no: string;
  seal_no: string;
  marks: string;
  number: string;
  quantity: number | null;
  package_type: string;
  description: string;
  gross_weight_kg: number | null;
  measurement_cbm: number | null;
}

export interface OtherInfo {
  number_of_originals: number | null;
  payment_method: string;
  payment_place: string;
  service_mode: string;
  issue_place: string;
  issue_date: string | null;
}

export interface ReviewData {
  hbl_no: string;
  so_no: string;
  status?: number;
  basic_info: BasicInfo;
  transport_info: TransportInfo;
  cargo_info: CargoInfo;
  other_info: OtherInfo;
}

export interface UploadedFile {
  hbl_no: string;
  so_no: string;
  file_name: string;
  file_size: number;
  file_url: string;
  status: 'success' | 'failed';
  error_msg?: string;
}

export interface FileUploadResult {
  total: number;
  success: number;
  confirm_token: string;
  files: UploadedFile[];
  errors?: string[];
}

export interface ConfirmResult {
  total?: number;
  success?: number;
  failed?: number;
  errors?: { hbl_no: string; so_no: string; msg: string }[];
}

export type SoNoValidStatus = 'empty' | 'checking' | 'valid' | 'duplicate' | 'confirmed';

export interface FileItem {
  id: string;
  file: File;
  file_name: string;
  file_size: number;
  so_no: string;
  so_no_valid: SoNoValidStatus;
  hbl_no?: string;
  file_url?: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  progress?: number;
  error_msg?: string;
}

export interface SoNoCheckResult {
  exists?: boolean;
  confirmed?: boolean;
  hbl_no?: string;
  file_name?: string;
  list?: ResourceItem[];
  total?: number;
}

export interface ResourceItem {
  hbl_no: string;
  so_no: string;
  file_name: string;
  file_size: number;
  file_url: string;
  status: number;
  status_text: string;
  created_at: string;
}

export interface ResourceListResult {
  total: number;
  list: ResourceItem[];
}

export const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '已上传', color: 'bg-blue-100 text-blue-800' },
  1: { label: '已上传待确认', color: 'bg-yellow-100 text-yellow-800' },
  2: { label: '已确认待发送', color: 'bg-purple-100 text-purple-800' },
  3: { label: '已发送至解析处', color: 'bg-indigo-100 text-indigo-800' },
  4: { label: '已接收到成功的解析', color: 'bg-teal-100 text-teal-800' },
  5: { label: '已入库待审查', color: 'bg-yellow-100 text-yellow-800' },
  6: { label: '已审查', color: 'bg-green-100 text-green-800' },
  7: { label: '已转发下游', color: 'bg-green-100 text-green-800' },
  8: { label: '下游已接收', color: 'bg-emerald-100 text-emerald-800' },
  9: { label: '链路出现错误', color: 'bg-red-100 text-red-800' },
};

export const MAX_FILES = 20;
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  '.xlsx', '.xls',
  '.doc', '.docx',
  '.jpg', '.jpeg', '.pdf', '.png', '.gif', '.bmp', '.webp',
];

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}