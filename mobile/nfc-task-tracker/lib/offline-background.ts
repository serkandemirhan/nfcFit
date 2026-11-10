import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { offlineStore } from './offline-store';
import { syncCoaching } from './coaching';
import { syncOffline } from './offline-sync';
const TASK='nfcfit-offline-sync-v1';
TaskManager.defineTask(TASK,async()=>{
  try{
    if(await AsyncStorage.getItem('nfcfit:explicit-logout')==='true')return BackgroundTask.BackgroundTaskResult.Success;
    const user=await AsyncStorage.getItem('nfcfit:last-user');
    const {data}=await supabase.auth.getSession();
    const profile=user?await offlineStore.getDoc<{supabaseUserId:string}>(user,'profile'):null;
    if(user&&data.session?.user.id===profile?.supabaseUserId)await Promise.all([syncOffline(user),syncCoaching(user)]);
    return BackgroundTask.BackgroundTaskResult.Success;
  }catch{return BackgroundTask.BackgroundTaskResult.Failed;}
});
export async function registerOfflineBackgroundSync(){
  if(!await TaskManager.isAvailableAsync())return;
  if(!await TaskManager.isTaskRegisteredAsync(TASK))await BackgroundTask.registerTaskAsync(TASK,{minimumInterval:15});
}
