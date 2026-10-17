// Secure server-only Expo push dispatcher.
// Call with Authorization: Bearer <NOTIFICATION_DISPATCH_SECRET> from a trusted scheduler.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NOTIFICATION_DISPATCH_SECRET.
// Never invoke from a mobile client and never put service role credentials in Expo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type NotificationRow = {
 id:string; recipient_profile_id:string; order_id:string|null;
 title:string; body:string; category:string;
};
type DeviceRow = {expo_push_token:string;profile_id:string};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json','cache-control':'no-store'}
});
Deno.serve(async(req)=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const secret=Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
 if(!secret||secret.length<32||req.headers.get('authorization')!==`Bearer ${secret}`)
   return json({error:'Unauthorized'},401);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return json({error:'Missing server configuration'},503);
 const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:notifications,error}=await db.from('portal_notifications')
   .select('id,recipient_profile_id,order_id,title,body,category')
   .is('push_sent_at',null).order('created_at',{ascending:true}).limit(100);
 if(error)return json({error:'Could not load notifications'},500);
 if(!notifications?.length)return json({processed:0,queued:0});
 const profiles=[...new Set((notifications as NotificationRow[]).map(n=>n.recipient_profile_id))];
 const {data:active,error:profilesError}=await db.from('portal_profiles')
   .select('id').in('id',profiles).eq('is_active',true);
 if(profilesError)return json({error:'Could not verify recipient accounts'},500);
 const activeSet=new Set((active??[]).map(p=>p.id));
 const {data:devices,error:deviceError}=await db.from('portal_push_devices')
   .select('profile_id,expo_push_token').in('profile_id',profiles);
 if(deviceError)return json({error:'Could not load registered devices'},500);
 const tokens=new Map<string,string[]>();
 for(const device of (devices??[]) as DeviceRow[]){
   if(!activeSet.has(device.profile_id))continue;
   if(!/^ExpoPushToken\\[[^\\]]+\\]$/.test(device.expo_push_token))continue;
   tokens.set(device.profile_id,[...(tokens.get(device.profile_id)??[]),device.expo_push_token]);
 }
 let accepted=0,failed=0,notRegistered=0;
 // Sequential per notification ensures idempotency marking applies only when all
 // device tokens are accepted. Unaccepted entries remain eligible for retry.
 for(const notification of notifications as NotificationRow[]){
  if(!activeSet.has(notification.recipient_profile_id))continue;
  const destination=[...new Set(tokens.get(notification.recipient_profile_id)??[])];
  if(!destination.length){notRegistered++;continue;}
  try{
   const messages=destination.map(to=>({
    to,title:notification.title,body:notification.body,sound:'default',
    channelId:'operations',data:{orderId:notification.order_id??undefined,notificationId:notification.id}
   }));
   const response=await fetch('https://exp.host/--/api/v2/push/send',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(messages),signal:AbortSignal.timeout(15000)
   });
   if(!response.ok){failed++;continue;}
   const payload=await response.json();
   const tickets=Array.isArray(payload.data)?payload.data:[payload.data];
   if(tickets.length!==messages.length||tickets.some((ticket:any)=>ticket?.status!=='ok')){
     failed++;continue;
   }
   // Expo accepted submission (not proof of device delivery); receipts still need
   // a separate periodic inspection process for production-grade monitoring.
   const {error:updateError}=await db.from('portal_notifications')
     .update({push_sent_at:new Date().toISOString()}).eq('id',notification.id).is('push_sent_at',null);
   if(updateError){failed++;continue;}
   accepted++;
  }catch{failed++;}
 }
 return json({processed:notifications.length,accepted,failed,notRegistered,
   note:'accepted means Expo ticket accepted; device delivery receipt not yet verified'});
});
