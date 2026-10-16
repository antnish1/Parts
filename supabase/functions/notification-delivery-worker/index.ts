import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Call from a trusted scheduler with NOTIFICATION_WORKER_SECRET.
// Never accept a user access token to trigger bulk push sends.
serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('NOTIFICATION_WORKER_SECRET');
 if(!secret||req.headers.get('x-worker-secret')!==secret)return new Response('Unauthorized',{status:401});
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return new Response('Missing service configuration',{status:500});
 const db=createClient(url,key);
 const {error:queueError}=await db.rpc('portal_queue_delayed_vor_alerts');
 if(queueError)return new Response(JSON.stringify({error:'Queueing failed'}),{status:500});
 const {data:pending,error}=await db.from('portal_notifications')
  .select('id,recipient_profile_id,order_id,title,body')
  .is('push_sent_at',null).order('created_at',{ascending:true}).limit(100);
 if(error)return new Response(JSON.stringify({error:'Read failed'}),{status:500});
 let sent=0;let failed=0;
 for(const item of pending??[]){
   const {data:devices,error:deviceError}=await db.from('portal_push_devices').select('expo_push_token').eq('profile_id',item.recipient_profile_id);
   if(deviceError){failed++;continue;}
   if(!devices?.length)continue; // Leave pending: deliver if a device is registered later.
   const messages=devices.map(d=>({to:d.expo_push_token,sound:'default',title:item.title,body:item.body,
     channelId:'operations',data:{orderId:item.order_id,notificationId:item.id}}));
   try{
     const res=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(messages)});
     const result=await res.json();
     const tickets=Array.isArray(result.data)?result.data:[result.data];
     if(!res.ok||tickets.some((ticket:{status?:string})=>ticket?.status!=='ok')){failed++;continue;}
     const {error:markError}=await db.from('portal_notifications').update({push_sent_at:new Date().toISOString()}).eq('id',item.id).is('push_sent_at',null);
     if(markError){failed++;continue;}
     sent++;
   }catch{failed++;}
 }
 return new Response(JSON.stringify({queued:(pending??[]).length,sent,failed}),{headers:{'Content-Type':'application/json'}});
});
