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

/**
 * Issues only explicitly selected RECEIVED item IDs.
 * Server checks order permissions, fully received quantities and prevents
 * duplicate item issuance before deriving the correct order-level status.
 */
export async function markOrderItemsIssued(
  orderId: string,
  itemIds: string[],
  documentType: IssuedDocumentType,
  documentNo: string,
) {
  const cleanNo = documentNo.trim().toUpperCase();
  const ids = [...new Set(itemIds)];
  if (!orderId) throw new Error('Order ID is required.');
  if (!ids.length || ids.length !== itemIds.length) throw new Error('Select unique received parts to issue.');
  if (!issuedDocumentTypes.includes(documentType)) throw new Error('Select a valid issued document type.');
  if (!cleanNo) throw new Error('Issued document number is required.');

  const { data, error } = await supabase.rpc('mark_portal_order_items_issued', {
    p_order_id: orderId,
    p_item_ids: ids,
    p_document_type: documentType,
    p_document_no: cleanNo,
  });
  if (error) throw error;
  return data;
}
