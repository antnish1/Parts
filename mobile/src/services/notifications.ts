import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { getCurrentPortalProfile } from '@/services/profile';
export type PortalNotification={id:string;order_id:string|null;event_key:string;category:string;title:string;body:string;created_at:string;read_at:string|null};
export async function getNotifications():Promise<PortalNotification[]>{
 const {data,error}=await supabase.from('portal_notifications').select('id,order_id,event_key,category,title,body,created_at,read_at').order('created_at',{ascending:false}).limit(100);
 if(error){
   // The optional notification migration may not yet be deployed. Keep permanent Activity available.
   if(error.code==='42P01'||error.code==='PGRST205'||error.code==='PGRST116'&&error.message?.includes('portal_notifications'))return [];
   throw error;
 }
 const profile=await getCurrentPortalProfile();
 const role=String(profile?.role??'').toLowerCase();
 return ((data??[]) as PortalNotification[]).filter(n=>n.category!=='order'||role==='manager'||role==='super');
}
export async function markNotificationRead(id:string){
 const {error}=await supabase.from('portal_notifications').update({read_at:new Date().toISOString()}).eq('id',id).is('read_at',null);
 if(error)throw error;
}
const PUSH_TOKEN_KEY='parts-connect-push-device-token';
export async function registerPushToken(_profileId:string,token:string){
 const {error}=await supabase.rpc('portal_register_push_device',{push_token:token});
 if(error)throw error;
 await SecureStore.setItemAsync(PUSH_TOKEN_KEY,token);
}
export async function revokeCurrentPushToken(profileId:string){
 const token=await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
 if(!token)return;
 const {error}=await supabase.from('portal_push_devices').delete().eq('profile_id',profileId).eq('expo_push_token',token);
 if(error)throw error;
 await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}
