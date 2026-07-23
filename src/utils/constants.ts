export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const RESOURCE_BASE_URL = import.meta.env.VITE_RESOURCE_BASE_URL || '/files';

export const ENDPOINTS = {
  RESOURCE_QUERY: '/api/v1/resource/query',
  RECEIVE_FILE: '/api/v1/receive/file',
  CONFIRM_FILE: '/api/v1/confirm/file',
  REVIEW_DETAIL: '/api/v1/review/detail',
  REVIEW_UPDATE: '/api/v1/review/update',
  REVIEW_CONFIRM: '/api/v1/review/confirm',
  CANCEL_UPLOAD: '/api/v1/receive/cancel',
};