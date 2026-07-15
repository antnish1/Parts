import { supabase } from '../lib/supabase';

export const issuedDocumentTypes = ['DC', 'Tax Invoice', 'PI', 'Manual', 'Warranty Claim'] as const;
export type IssuedDocumentType = typeof issuedDocumentTypes[number];

export async function markOrderIssued(orderId: string, documentType: IssuedDocumentType, documentNo: string) {
  const cleanNo = documentNo.trim().toUpperCase();
  if (!orderId) throw new Error('Order ID is required.');
  if (!issuedDocumentTypes.includes(documentType)) throw new Error('Select a valid issued document type.');
  if (!cleanNo) throw new Error('Issued document number is required.');

  const { data, error } = await supabase.rpc('mark_portal_order_issued', {
    p_order_id: orderId,
    p_document_type: documentType,
    p_document_no: cleanNo,
  });
  if (error) throw error;
  return data;
}
