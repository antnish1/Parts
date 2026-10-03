import { supabase } from '@/lib/supabase';
import { getCurrentPortalProfile } from '@/services/profile';

export type OrderEvent={id:string;event_type:string;old_status:string|null;new_status:string|null;notes:string|null;created_at:string};
export type OrderCommentAttachment={id:string;comment_id:string;original_file_name:string;mime_type:string;file_size_bytes:number;created_at:string};
export type OrderComment={id:string;comment_type:string;body:string|null;attachment_path:string|null;created_at:string;author?:{full_name:string|null;role:string|null}|null;attachments:OrderCommentAttachment[]};
export type BillingChunk={id:string;item_id:string;order_id:string;order_no:string;part_no:string;billed_qty:number|null;received_qty:number|null;received_at:string|null;billing_date:string|null;order_reg_date:string|null;delivery_no:string|null;invoice_no:string|null;docket_no:string|null;transport_name:string|null;transport_mode:string|null;packing_detail:string|null;eway_bill_no:string|null;gst_invoice_no:string|null;raw_status:string|null;source:string|null;created_at:string};

type RawComment=Omit<OrderComment,'author'|'attachments'>&{author?:{full_name:string|null;role:string|null}|Array<{full_name:string|null;role:string|null}>|null};
function normalizeText(value:string){return value.trim().replace(/\s+/g,' ')}
export async function getOrderActivity(orderId:string){
 const [eventsResult,commentsResult,billingResult]=await Promise.all([
  supabase.from('portal_order_events').select('id,event_type,old_status,new_status,notes,created_at').eq('order_id',orderId).order('created_at',{ascending:false}).limit(50),
  supabase.from('portal_order_comments').select('id,comment_type,body,attachment_path,created_at,author:portal_profiles!portal_order_comments_author_id_fkey(full_name,role)').eq('order_id',orderId).eq('comment_type','user').order('created_at',{ascending:false}).limit(50),
  supabase.from('portal_order_item_billings').select('id,item_id,order_id,order_no,part_no,billed_qty,received_qty,received_at,billing_date,order_reg_date,delivery_no,invoice_no,docket_no,transport_name,transport_mode,packing_detail,eway_bill_no,gst_invoice_no,raw_status,source,created_at').eq('order_id',orderId).order('created_at',{ascending:true})
 ]);
 if(eventsResult.error)throw eventsResult.error;if(commentsResult.error)throw commentsResult.error;if(billingResult.error)throw billingResult.error;
 const raw=(commentsResult.data??[]) as unknown as RawComment[]; const ids=raw.map((c)=>c.id); let attachmentMap=new Map<string,OrderCommentAttachment[]>(); if(ids.length){const {data,error}=await supabase.from('portal_order_comment_attachments').select('id,comment_id,original_file_name:original_filename,mime_type,file_size_bytes:size_bytes,created_at').eq('order_id',orderId).in('comment_id',ids).order('created_at');if(!error)for(const attachment of (data??[]) as OrderCommentAttachment[])attachmentMap.set(attachment.comment_id,[...(attachmentMap.get(attachment.comment_id)??[]),attachment]);}
 return {events:(eventsResult.data??[]) as OrderEvent[],comments:raw.map((c)=>({...c,author:Array.isArray(c.author)?c.author[0]??null:c.author??null,attachments:attachmentMap.get(c.id)??[]})),billings:(billingResult.data??[]) as BillingChunk[]};
}
export async function addOrderComment(orderId:string,body:string){const text=normalizeText(body);if(!text)throw new Error('Comment is required.');const profile=await getCurrentPortalProfile();const {data:recent,error:recentError}=await supabase.from('portal_order_comments').select('body').eq('order_id',orderId).eq('comment_type','user').order('created_at',{ascending:false}).limit(5);if(recentError)throw recentError;if((recent??[]).some((c)=>normalizeText(c.body??'').toLowerCase()===text.toLowerCase()))throw new Error('Duplicate comment already exists for this order.');const {data,error}=await supabase.from('portal_order_comments').insert({order_id:orderId,author_id:profile?.id??null,comment_type:'user',body:text}).select('id').single();if(error)throw error;return data as {id:string};}
export async function getOrderAttachmentUrl(attachmentId:string){const {data,error}=await supabase.functions.invoke('comment-attachment-link-action',{body:{attachmentId}});if(error)throw error;if(data?.error)throw new Error(String(data.error));return data as {signedUrl:string;expiresIn:number;fileName:string};}
