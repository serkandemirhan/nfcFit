import { WellnessGoal, WellnessLog, WellnessType } from '../types';

export const fallbackWellnessTypes: WellnessType[] = [
  { id: 'water', name: 'Water', category: 'hydration', unit: 'ml', icon: 'water' },
  { id: 'coffee', name: 'Coffee', category: 'nutrition', unit: 'cups', icon: 'coffee' },
  { id: 'meditation', name: 'Meditation', category: 'mindfulness', unit: 'minutes', icon: 'meditation' },
  { id: 'walk_break', name: 'Walk Breaks', category: 'movement', unit: 'count', icon: 'walk' },
  { id: 'vitamins', name: 'Vitamins', category: 'supplement', unit: 'count', icon: 'vitamins' },
];

export const fallbackWellnessGoals: WellnessGoal[] = [
  { user_id: 'u1', wellness_type_id: 'water', target_quantity: 3000, unit: 'ml', active: true },
  { user_id: 'u1', wellness_type_id: 'coffee', target_quantity: 3, unit: 'cups', active: true },
  { user_id: 'u1', wellness_type_id: 'meditation', target_quantity: 15, unit: 'minutes', active: true },
  { user_id: 'u1', wellness_type_id: 'walk_break', target_quantity: 6, unit: 'count', active: true },
  { user_id: 'u1', wellness_type_id: 'vitamins', target_quantity: 1, unit: 'count', active: true },
];

export const fallbackWellnessLogs: WellnessLog[] = [
  { id: 'wl1', user_id: 'u1', wellness_type_id: 'water', wellness_name: 'Water', quantity: 1800, unit: 'ml', source: 'manual', createdat: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: 'wl2', user_id: 'u1', wellness_type_id: 'coffee', wellness_name: 'Coffee', quantity: 2, unit: 'cups', source: 'manual', createdat: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
  { id: 'wl3', user_id: 'u1', wellness_type_id: 'meditation', wellness_name: 'Meditation', quantity: 10, unit: 'minutes', source: 'manual', createdat: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 'wl4', user_id: 'u1', wellness_type_id: 'walk_break', wellness_name: 'Walk Breaks', quantity: 3, unit: 'count', source: 'manual', createdat: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { id: 'wl5', user_id: 'u1', wellness_type_id: 'vitamins', wellness_name: 'Vitamins', quantity: 1, unit: 'count', source: 'manual', createdat: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
];
