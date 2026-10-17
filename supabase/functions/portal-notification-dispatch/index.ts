// Server-only dispatcher. Requires a verified bearer secret and service role.
// Each delivery is leased atomically by Postgres, so concurrent schedulers
// cannot select the same queued device notification.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
type Delivery={id:string;lease_token:string;expo_push_token:string;order_id:string|null;title:string;body:string;notification_id:string};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const isToken=(s:string)=>/^(ExpoPushToken|ExponentPushToken)\\[[^\\]]+\\]$/.test(s);
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const secret=Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
 if(!secret||secret.length<32||req.headers.get('authorization')!==`Bearer ${secret}`)return reply({error:'Unauthorized'},401);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return reply({error:'Missing server configuration'},503);
 const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {error:fillError}=await db.rpc('portal_push_fill_queue',{max_rows:200});
 if(fillError)return reply({error:'Queue synchronization failed'},503);
 const {data:claimed,error:claimError}=await db.rpc('portal_push_claim',{max_rows:40});
 if(claimError)return reply({error:'Queue claim failed'},503);
 let accepted=0,retried=0,invalid=0,failed=0;
 for(const d of (claimed??[]) as Delivery[]){
  let status='retry',ticket:string|null=null,reason:string|null=null;
  if(!isToken(d.expo_push_token)){status='invalid_token';reason='Invalid Expo token format';}
  else try{
   const res=await fetch('https://exp.host/--/api/v2/push/send',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({to:d.expo_push_token,sound:'default',channelId:'operations',
      title:d.title,body:d.body,data:{orderId:d.order_id,notificationId:d.notification_id}}),
    signal:AbortSignal.timeout(15000)
   });
   if(res.status===429||res.status>=500){reason=`Expo HTTP ${res.status}`;}
   else if(!res.ok){status='failed';reason=`Expo HTTP ${res.status}`;}
   else{
    const payload=await res.json();
    const t=Array.isArray(payload.data)?payload.data[0]:payload.data;
    if(t?.status==='ok'&&typeof t.id==='string'){status='ticket_ok';ticket=t.id;}
    else{reason=String(t?.message??'Expo rejected ticket');status=t?.details?.error==='DeviceNotRegistered'?'invalid_token':'failed';}
   }
  }catch(e){reason=e instanceof Error?e.message:'Network failure';}
  const {data:finished,error:finishError}=await db.rpc('portal_push_finish',{
   p_id:d.id,p_lease_token:d.lease_token,p_status:status,p_ticket_id:ticket,p_error:reason
  });
  if(finishError||!finished){failed++;continue;}
  if(status==='ticket_ok')accepted++;
  else if(status==='retry')retried++;
  else if(status==='invalid_token')invalid++;
  else failed++;
 }
 return reply({claimed:(claimed??[]).length,accepted,retried,invalid,failed,
  note:'Expo accepted tickets; delivery receipts require verification by the separate receipt processor.'});
});
