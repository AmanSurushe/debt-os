import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: 'severity-critical',
    high: 'severity-high',
    medium: 'severity-medium',
    low: 'severity-low',
    info: 'severity-info',
  };
  return colors[severity.toLowerCase()] || 'severity-info';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    open: 'bg-blue-500/20 text-blue-400',
    acknowledged: 'bg-purple-500/20 text-purple-400',
    planned: 'bg-indigo-500/20 text-indigo-400',
    in_progress: 'bg-yellow-500/20 text-yellow-400',
    resolved: 'bg-green-500/20 text-green-400',
    wont_fix: 'bg-gray-500/20 text-gray-400',
  };
  return colors[status.toLowerCase()] || 'bg-gray-500/20 text-gray-400';
}

export function getProviderIcon(provider: string): string {
  return provider === 'github' ? 'github' : 'gitlab';
}
