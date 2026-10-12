import { supabase } from '@/lib/supabase';

export type DeveloperProfile={id:string;full_name:string;branch:string;role:string;login_id:string|null;is_active:boolean;created_at:string};
export type BranchOption={branch_key:string;display_name:string;branch_name:string};
export type DeveloperComment={id:string;order_id:string;comment:string;created_at:string;created_by:string|null;order_no:string;final_order_no:string|null;branch:string;status:string};
const roles=['branch','admin','super','manager','viewer','developer','hq','accounts'] as const;
export {roles as portalRoles};
function friendly(message:string){const text=message.toLowerCase();if(text.includes('user id')||text.includes('legacy_user_id')||text.includes('login_id'))return 'This User ID is already assigned.';if(text.includes('already')||text.includes('registered')||text.includes('duplicate'))return 'This email or User ID is already registered.';if(text.includes('developer'))return 'Only an active developer can manage portal users.';return message||'User operation failed.'}
async function invoke(name:string,body:Record<string,unknown>){const {data,error}=await supabase.functions.invoke(name,{body});if(error)throw new Error(friendly(error.message));if(data?.error)throw new Error(friendly(String(data.error)));return data;}
export async function getDeveloperProfiles(){const {data,error}=await supabase.from('portal_profiles').select('id,full_name,branch,role,login_id:legacy_user_id,is_active,created_at').order('created_at',{ascending:false}).limit(100);if(error)throw error;return (data??[]) as DeveloperProfile[];}
export async function getDeveloperBranches(){const {data,error}=await supabase.from('portal_branches').select('branch_key,display_name,branch_name').eq('is_active',true).order('sort_order').order('display_name');if(error)throw error;return (data??[]) as BranchOption[];}
export async function createPortalUser(input:{loginId:string;email:string;password:string;fullName:string;branch:string;role:string}){return invoke('create-portal-user',{email:input.email.trim().toLowerCase(),password:input.password.trim(),fullName:input.fullName.trim(),branch:input.branch.trim(),role:input.role.trim(),loginId:input.loginId.trim().replace(/\s+/g,'').toUpperCase()});}
export async function updatePortalUser(profile:DeveloperProfile,input:{fullName:string;branch:string;role:string;loginId:string;isActive:boolean}){return invoke('update-portal-user',{profileId:profile.id,fullName:input.fullName.trim(),branch:input.branch.trim(),role:input.role.trim(),loginId:input.loginId.trim().replace(/\s+/g,'').toUpperCase(),isActive:input.isActive});}
export async function getDeveloperComments(){const {data,error}=await supabase.from('portal_order_comments').select('id,order_id,comment:body,created_at,created_by:author_id,order:portal_orders(order_no,final_order_no,branch,status)').order('created_at',{ascending:false}).limit(40);if(error)throw error;return (data??[]).map((row)=>{const order=Array.isArray(row.order)?row.order[0]:row.order;return{id:row.id,order_id:row.order_id,comment:row.comment,created_at:row.created_at,created_by:row.created_by,order_no:order?.order_no??'-',final_order_no:order?.final_order_no??null,branch:order?.branch??'-',status:order?.status??'-'}}) as DeveloperComment[];}
export async function getDeveloperStats(){
  const [orders,pending,processed,parts,profiles,branches]=await Promise.all([
    supabase.from('portal_orders').select('id',{count:'exact',head:true}),
    supabase.from('portal_orders').select('id',{count:'exact',head:true}).or('status.ilike.%pending%,approval_status.ilike.%pending%'),
    supabase.from('portal_orders').select('id',{count:'exact',head:true}).eq('status','processed'),
    supabase.from('part_master').select('*',{count:'exact',head:true}),
    supabase.from('portal_profiles').select('id',{count:'exact',head:true}),
    supabase.from('portal_branches').select('id',{count:'exact',head:true}).eq('is_active',true),
  ]);
  return{
    orders:orders.count??0,
    pending:pending.count??0,
    processed:processed.count??0,
    parts:parts.count??0,
    profiles:profiles.count??0,
    branches:branches.count??0,
  };
}
