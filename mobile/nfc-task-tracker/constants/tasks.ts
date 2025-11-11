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
  const isDark = resolveScheme(scheme) === 'dark';
  return {
    background: isDark ? '#0B0D13' : '#F7F8FC',
    card: isDark ? '#171C28' : '#FFFFFF',
    border: isDark ? '#242B3B' : '#E3E8F5',
    mutedText: isDark ? '#98A0B7' : '#5C637A',
    text: isDark ? '#ECEFF7' : '#0F172A',
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
