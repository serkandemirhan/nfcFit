import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createActivityWorkflow, createGoalCelebrationClaim } from './activity-workflow';
import { recordTenantActivity } from './tenant-console';
function uuid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const activitySubmission = createActivityWorkflow(AsyncStorage, recordTenantActivity, uuid);
export const claimGoalCelebration = createGoalCelebrationClaim(AsyncStorage);
