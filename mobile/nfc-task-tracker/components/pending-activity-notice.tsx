import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { activitySubmission } from '@/lib/activity-submission';
import { ManagementButton as Button, ManagementCard as Card } from './management-ui';
export function PendingActivityNotice() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true; setPending(false);
    if (user?.id) void activitySubmission.load(user.id).then(value => { if (active) setPending(Boolean(value)); }).catch(() => { if (active) setPending(true); });
    return () => { active = false; };
  }, [user?.id]));
  return pending ? <Card title="Son kaydını kontrol et" hint="Bağlantı kesilmiş olabilir. Aynı işlemi güvenle tekrar kontrol edebilirsin."><Button title="Bekleyen kaydı aç" onPress={() => router.push('/record-activity' as never)} /></Card> : null;
}
