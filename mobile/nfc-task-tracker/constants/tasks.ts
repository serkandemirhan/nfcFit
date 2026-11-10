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
    background: isDark ? '#10191F' : '#F4F7F5',
    card: isDark ? '#19272F' : '#FFFFFF',
    cardRaised: isDark ? '#22343F' : '#F5F8F6',
    border: isDark ? 'rgba(148,163,184,0.20)' : '#DFE8E1',
    mutedText: isDark ? '#8EA0B8' : '#64736A',
    text: isDark ? '#F8FAFC' : '#17251C',
    green: '#16803C',
    purple: '#16803C',
    blue: '#16803C',
    amber: '#16803C',
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
