import { supabase } from '../lib/supabase';

export const INSTALLATION_VIEWER_PROFILE_ID = '9f3c378e-89d4-4427-87f2-c66061dbf3e2';
export type InstallationStatus = 'PENDING' | 'COMPLETED' | 'ACCEPTED';
export type EquipmentType = 'ENGINE' | 'ROCK_BREAKER';
export type InstallationDocumentType = 'JCB_INVOICE' | 'DBMS_INVOICE' | 'SVR';

export type InstallationItem = { id?: string; part_no: string; description: string; quantity: number };
export type InstallationDocument = { id: string; installation_id: string; document_type: InstallationDocumentType; storage_path: string; file_name: string; mime_type: string; file_size: number; uploaded_at: string; is_active: boolean };
export type InstallationEntry = {
  id: string; entry_no: string; equipment_type: EquipmentType; invoice_date: string; branch: string; invoice_no: string;
  customer_name: string; status: InstallationStatus; jcb_invoice_no: string | null; svr_no: string | null;
  equipment_registration_no: string | null; created_at: string; branch_submitted_at: string | null; accepted_at: string | null;
  portal_installation_items?: InstallationItem[]; portal_installation_documents?: InstallationDocument[];
};

function throwIfError(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function listInstallationEntries(): Promise<InstallationEntry[]> {
  const { data, error } = await supabase.from('portal_installation_entries')
    .select('id,entry_no,equipment_type,invoice_date,branch,invoice_no,customer_name,status,jcb_invoice_no,svr_no,equipment_registration_no,created_at,branch_submitted_at,accepted_at,portal_installation_items(id,part_no,description,quantity),portal_installation_documents(id,installation_id,document_type,storage_path,file_name,mime_type,file_size,uploaded_at,is_active)')
    .order('created_at', { ascending: false });
  throwIfError(error); return (data ?? []) as InstallationEntry[];
}

export async function getInstallationEntry(id: string): Promise<InstallationEntry> {
  const { data, error } = await supabase.from('portal_installation_entries')
    .select('id,entry_no,equipment_type,invoice_date,branch,invoice_no,customer_name,status,jcb_invoice_no,svr_no,equipment_registration_no,created_at,branch_submitted_at,accepted_at,portal_installation_items(id,part_no,description,quantity),portal_installation_documents(id,installation_id,document_type,storage_path,file_name,mime_type,file_size,uploaded_at,is_active)')
    .eq('id', id).single();
  throwIfError(error); return data as InstallationEntry;
}

export async function listInstallationBranches(): Promise<string[]> {
  const { data, error } = await supabase.from('portal_profiles').select('branch').eq('is_active', true).not('branch', 'is', null);
  throwIfError(error);
  return [...new Set((data ?? []).map((row) => String(row.branch ?? '').trim()).filter(Boolean))].sort();
}

export async function createInstallationEntry(input: { equipment_type: EquipmentType; invoice_date: string; branch: string; invoice_no: string; customer_name: string; items: InstallationItem[] }) {
  const { data, error } = await supabase.rpc('portal_create_installation_entry', {
    p_equipment_type: input.equipment_type, p_invoice_date: input.invoice_date, p_branch: input.branch,
    p_invoice_no: input.invoice_no, p_customer_name: input.customer_name, p_items: input.items,
  });
  throwIfError(error); return data as string;
}

export async function uploadInstallationDocument(installationId: string, type: InstallationDocumentType, file: File) {
  const isImage = file.type.startsWith('image/');
  if (isImage && file.size < 500 * 1024) throw new Error('Image must be larger than 500 KB. Upload a clearer image.');
  if (file.size > 15 * 1024 * 1024) throw new Error('File size must not exceed 15 MB.');
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${installationId}/${type.toLowerCase()}/${Date.now()}-${safe}`;
  const { error: uploadError } = await supabase.storage.from('installation-documents').upload(path, file, { upsert: false, contentType: file.type });
  throwIfError(uploadError);
  const { data: profileData, error: profileError } = await supabase.from('portal_profiles').select('id').eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle();
  throwIfError(profileError);
  await supabase.from('portal_installation_documents').update({ is_active: false }).eq('installation_id', installationId).eq('document_type', type).eq('is_active', true);
  const { error } = await supabase.from('portal_installation_documents').insert({ installation_id: installationId, document_type: type, storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size, uploaded_by: profileData?.id ?? null });
  throwIfError(error);
}

export async function getInstallationDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from('installation-documents').createSignedUrl(path, 300);
  throwIfError(error); return data.signedUrl;
}

export async function submitInstallationEntry(id: string, jcbInvoiceNo: string, svrNo: string) {
  const { error } = await supabase.rpc('portal_submit_installation_entry', { p_installation_id: id, p_jcb_invoice_no: jcbInvoiceNo, p_svr_no: svrNo });
  throwIfError(error);
}

export async function acceptInstallationEntry(id: string, registrationNo: string) {
  const { error } = await supabase.rpc('portal_accept_installation_entry', { p_installation_id: id, p_registration_no: registrationNo });
  throwIfError(error);
}
