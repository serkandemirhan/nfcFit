import type { ColorSchemeName } from 'react-native';

import type { TaskStatus } from '@/lib/api';

const STATUS_META: Record<
  TaskStatus,
  { label: string; light: { bg: string; text: string }; dark: { bg: string; text: string } }
> = {
  not_started: {
    label: 'Not Started',
    light: { bg: '#E7ECFF', text: '#233876' },
    dark: { bg: '#233876', text: '#E7ECFF' },
  },
  in_progress: {
    label: 'In Progress',
    light: { bg: '#FFF4E5', text: '#8C4C05' },
    dark: { bg: '#8C4C05', text: '#FFE0B2' },
  },
  completed: {
    label: 'Completed',
    light: { bg: '#E7F8F0', text: '#126C4E' },
    dark: { bg: '#0F3F32', text: '#8FF0C6' },
  },
  canceled: {
    label: 'Canceled',
    light: { bg: '#FEECEC', text: '#A11E1E' },
    dark: { bg: '#5B1010', text: '#F8C0C0' },
  },
};

function resolveScheme(scheme?: ColorSchemeName | null) {
  return scheme === 'dark' ? 'dark' : 'light';
}

export function getStatusBadgeColors(status: TaskStatus, scheme?: ColorSchemeName | null) {
  const meta = STATUS_META[status] ?? STATUS_META.not_started;
  const palette = resolveScheme(scheme) === 'dark' ? meta.dark : meta.light;
  return { ...palette, label: meta.label };
}

export function getSurfaceColors(scheme?: ColorSchemeName | null) {
  return {
    background: '#030B16',
    card: '#071827',
    cardRaised: '#0B1F32',
    border: 'rgba(148,163,184,0.20)',
    mutedText: '#8EA0B8',
    text: '#F8FAFC',
    green: '#35D353',
    purple: '#9B5CE5',
    blue: '#4AA3FF',
    amber: '#F59E0B',
  };
}

export function getActionColors(scheme?: ColorSchemeName | null) {
  const isDark = resolveScheme(scheme) === 'dark';
  return {
    text: isDark ? '#F8F9FD' : '#0F172A',
    background: isDark ? '#2C3652' : '#E1E8FF',
    pressed: isDark ? '#374269' : '#CAD6FF',
  };
}
