// Checks delivery receipts for previously accepted Expo tickets.
// Run with the same server-only NOTIFICATION_DISPATCH_SECRET as the dispatcher.
// A ticket is not a delivery receipt. We only mark delivered after a receipt "ok".
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
type Queue={id:string;device_id:string;expo_ticket_id:string;attempts:number;submitted_at:string};
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const secret=Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
 if(!secret||secret.length<32||req.headers.get('authorization')!==`Bearer ${secret}`)return reply({error:'Unauthorized'},401);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return reply({error:'Server credentials unavailable'},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:rows,error}=await db.from('portal_push_deliveries')
   .select('id,device_id,expo_ticket_id,attempts,submitted_at')
   .eq('status','ticket_ok').not('expo_ticket_id','is',null)
   .lt('submitted_at',new Date(Date.now()-90_000).toISOString())
   .order('submitted_at',{ascending:true}).limit(100);
 if(error)return reply({error:'Receipt queue query failed'},503);
 if(!rows?.length)return reply({checked:0,delivered:0,failed:0,pending:0});
 const tickets=(rows as Queue[]).map(row=>row.expo_ticket_id);
 let payload:any;
 try{
  const response=await fetch('https://exp.host/--/api/v2/push/getReceipts',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:tickets}),
   signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)return reply({error:'Expo receipt endpoint unavailable',http_status:response.status},503);
  payload=await response.json();
 }catch{return reply({error:'Expo receipt request failed'},503);}
 let delivered=0,failed=0,pending=0,invalid=0;
 for(const item of rows as Queue[]){
  const receipt=payload?.data?.[item.expo_ticket_id];
  if(!receipt){
   // Expo receipts can arrive late. Mark unreturned tickets failed after 24h
   // rather than silently claiming delivery or retrying an accepted message.
   if(new Date(item.submitted_at).getTime()<Date.now()-86_400_000){
    const {error:e}=await db.from('portal_push_deliveries')
     .update({status:'failed',last_error:'No Expo receipt within 24h',updated_at:new Date().toISOString()})
     .eq('id',item.id).eq('status','ticket_ok');
    if(!e)failed++;
   }else pending++;
   continue;
  }
  const isDelivered=receipt.status==='ok';
  const unregistered=receipt.details?.error==='DeviceNotRegistered';
  const newStatus=isDelivered?'delivered':unregistered?'invalid_token':'failed';
  const {data:updated,error:updateError}=await db.from('portal_push_deliveries')
   .update({status:newStatus,last_error:isDelivered?null:String(receipt.message??receipt.details?.error??'Delivery failed').slice(0,500),
     delivered_at:isDelivered?new Date().toISOString():null,updated_at:new Date().toISOString()})
   .eq('id',item.id).eq('status','ticket_ok').select('id').maybeSingle();
  if(updateError||!updated)continue;
  if(isDelivered)delivered++;else failed++;
  if(unregistered){
   // Delete only the token tied to the specific failed ticket.
   const {error:deleteError}=await db.from('portal_push_devices').delete().eq('id',item.device_id);
   if(!deleteError)invalid++;
  }
 }
 return reply({checked:rows.length,delivered,failed,pending,invalid_devices_removed:invalid});
});
