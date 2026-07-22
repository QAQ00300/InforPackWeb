import { API_BASE_URL, ENDPOINTS } from './constants';
import { ApiResponse, ReviewData } from '@/types';

export interface ResourceQueryResult {
  can_upload: boolean;
  status?: number;
  status_text?: string;
  message?: string;
  hbl_no?: string;
  so_no?: string;
  file_name?: string;
  file_url?: string;
}

export interface ReceiveFileResult {
  hbl_no: string;
  status: 'success' | 'failed';
  message?: string;
  error_msg?: string;
}

export interface ConfirmFileResult {
  hbl_no: string;
  status: 'success' | 'failed';
  message?: string;
}

export async function resourceQuery(so_no: string): Promise<ApiResponse<ResourceQueryResult>> {
  const response = await fetch(`${API_BASE_URL}${ENDPOINTS.RESOURCE_QUERY}?so_no=${encodeURIComponent(so_no)}`);
  return response.json();
}

export async function receiveFile(file: File, so_no: string, hbl_no?: string): Promise<ApiResponse<ReceiveFileResult>> {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('so_nos', so_no);
  
  if (hbl_no) {
    formData.append('hbl_nos', hbl_no);
  }

  const response = await fetch(`${API_BASE_URL}${ENDPOINTS.RECEIVE_FILE}`, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

export async function confirmFile(so_no: string, hbl_no?: string): Promise<ApiResponse<ConfirmFileResult>> {
  const params = new URLSearchParams();
  params.append('so_no', so_no);
  
  if (hbl_no) {
    params.append('hbl_no', hbl_no);
  }

  const response = await fetch(`${API_BASE_URL}${ENDPOINTS.CONFIRM_FILE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  return response.json();
}

export async function getReviewDetail(so_no: string): Promise<ApiResponse<ReviewData>> {
  const response = await fetch(`${API_BASE_URL}${ENDPOINTS.REVIEW_DETAIL}?so_no=${encodeURIComponent(so_no)}`);
  return response.json();
}

export async function updateReviewData(so_no: string, data: Omit<ReviewData, 'hbl_no' | 'so_no'>): Promise<ApiResponse> {
  const response = await fetch(
    `${API_BASE_URL}${ENDPOINTS.REVIEW_UPDATE}?so_no=${encodeURIComponent(so_no)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  return response.json();
}

export async function confirmReview(so_no: string): Promise<ApiResponse> {
  const params = new URLSearchParams();
  params.append('so_no', so_no);

  const response = await fetch(`${API_BASE_URL}${ENDPOINTS.REVIEW_CONFIRM}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  return response.json();
}

/**
 * 取消未确认的上传（页面关闭/离开时清理 temp 目录中的文件）
 * 使用 sendBeacon 确保页面卸载时可靠发送
 */
export function cancelUpload(so_no: string): boolean {
  const params = new URLSearchParams();
  params.append('so_no', so_no);

  return navigator.sendBeacon(
    `${API_BASE_URL}${ENDPOINTS.CANCEL_UPLOAD}`,
    params,
  );
}