import { STATUS_MAP } from '@/types';

interface StatusBadgeProps {
  statusCode: number;
}

export function StatusBadge({ statusCode }: StatusBadgeProps) {
  const status = STATUS_MAP[statusCode];
  if (!status) {
    return <span className="status-badge bg-gray-100 text-gray-800">未知状态</span>;
  }
  return <span className={`status-badge ${status.color}`}>{status.label}</span>;
}