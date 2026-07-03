import { supabase } from '../lib/supabase';

export type CommentAttachmentUploadResult = {
  id: string;
  order_id: string;
  comment_id: string;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
};

export async function uploadCommentAttachment(orderId: string, commentId: string, file: File) {
  if (!orderId || !commentId) throw new Error('Order and comment are required.');
  if (!file) throw new Error('Attachment file is required.');

  const form = new FormData();
  form.append('orderId', orderId);
  form.append('commentId', commentId);
  form.append('file', file);

  const { data, error } = await supabase.functions.invoke('comment-attachment-upload-action', { body: form });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data.attachment as CommentAttachmentUploadResult;
}

export async function getCommentAttachmentSignedUrl(attachmentId: string) {
  if (!attachmentId) throw new Error('Attachment is required.');
  const { data, error } = await supabase.functions.invoke('comment-attachment-link-action', { body: { attachmentId } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as { signedUrl: string; expiresIn: number; fileName: string };
}
