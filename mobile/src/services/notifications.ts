import { supabase } from '@/lib/supabase';
export type PortalNotification={id:string;order_id:string|null;category:string;title:string;body:string;created_at:string;read_at:string|null};
export async function getNotifications():Promise<PortalNotification[]>{
 const {data,error}=await supabase.from('portal_notifications').select('id,order_id,category,title,body,created_at,read_at').order('created_at',{ascending:false}).limit(100);
 if(error)throw error;
 return (data??[]) as PortalNotification[];
}
export async function markNotificationRead(id:string){
 const {error}=await supabase.from('portal_notifications').update({read_at:new Date().toISOString()}).eq('id',id).is('read_at',null);
 if(error)throw error;
}
export async function registerPushToken(profileId:string,token:string){
 const {error}=await supabase.from('portal_push_devices').upsert({profile_id:profileId,expo_push_token:token,updated_at:new Date().toISOString()},{onConflict:'profile_id,expo_push_token'});
 if(error)throw error;
}
export async function unregisterPushToken(profileId:string,token:string){
 const {error}=await supabase.from('portal_push_devices').delete().eq('profile_id',profileId).eq('expo_push_token',token);
 if(error)throw error;
}
