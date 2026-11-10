export async function restoreOfflineProfile<T extends {id:string;supabaseUserId?:string}>(
  storage:{getItem(key:string):Promise<string|null>},readProfile:(id:string)=>Promise<T|null>
):Promise<T|null>{
  if(await storage.getItem('nfcfit:explicit-logout')==='true')return null;
  const id=await storage.getItem('nfcfit:last-user');if(!id)return null;
  const profile=await readProfile(id);
  if(await storage.getItem('nfcfit:explicit-logout')==='true')return null;
  return profile?.id===id&&profile.supabaseUserId?profile:null;
}
