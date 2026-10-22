// Read-only validation endpoint. It never queries notifications or sends push.
// Intentionally uses the exact auth contract of dispatcher/receipts.
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json','cache-control':'no-store'}
});
Deno.serve((req:Request)=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const secret=Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
 if(!secret||secret.length<32||req.headers.get('authorization')!==`Bearer ${secret}`)
   return json({error:'Unauthorized'},401);
 return json({ok:true,check:'notification_dispatch_secret',safe:true});
});
