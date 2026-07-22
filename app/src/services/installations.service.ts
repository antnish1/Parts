import { supabase } from '../lib/supabase';

export const INSTALLATION_VIEWER_PROFILE_ID = '9f3c378e-89d4-4427-87f2-c66061dbf3e2';
export type InstallationStatus = 'PENDING' | 'ACCEPTANCE_PENDING' | 'ACCEPTED';
export type EquipmentType = 'ENGINE' | 'ROCK_BREAKER';
export type InstallationDocumentType = 'JCB_INVOICE' | 'DBMS_INVOICE' | 'SVR';

export type InstallationItem = { id?: string; part_no: string; description: string; quantity: number };
export type InstallationDocument = { id: string; installation_id: string; document_type: InstallationDocumentType; storage_path: string; file_name: string; mime_type: string; file_size: number; uploaded_at: string; is_active: boolean };
export type InstallationEntry = {
  id: string; entry_no: string; equipment_type: EquipmentType; invoice_date: string; branch: string; invoice_no: string;
  customer_name: string; equipment_no: string | null; status: InstallationStatus; jcb_invoice_no: string | null; svr_no: string | null;
  equipment_registration_no: string | null; created_at: string; branch_submitted_at: string | null; accepted_at: string | null;
  portal_installation_items?: InstallationItem[]; portal_installation_documents?: InstallationDocument[];
};

export type PartMasterMatch = { part_no: string; description: string };
type MessageError = { message: string } | null;
function throwIfError(error: MessageError) { if (error) throw new Error(error.message); }

const entrySelect = 'id,entry_no,equipment_type,invoice_date,branch,invoice_no,customer_name,equipment_no,status,jcb_invoice_no,svr_no,equipment_registration_no,created_at,branch_submitted_at,accepted_at,portal_installation_items(id,part_no,description,quantity),portal_installation_documents(id,installation_id,document_type,storage_path,file_name,mime_type,file_size,uploaded_at,is_active)';

export async function listInstallationEntries(): Promise<InstallationEntry[]> {
  const { data, error } = await supabase.from('portal_installation_entries').select(entrySelect).order('created_at', { ascending: false });
  throwIfError(error); return (data ?? []) as unknown as InstallationEntry[];
}

export async function getInstallationEntry(id: string): Promise<InstallationEntry> {
  const { data, error } = await supabase.from('portal_installation_entries').select(entrySelect).eq('id', id).single();
  throwIfError(error); return data as unknown as InstallationEntry;
}

export async function getInstallationPendingCount(): Promise<number> {
  const rows = await listInstallationEntries();
  return rows.filter((entry) => entry.status !== 'ACCEPTED').length;
}

export async function listInstallationBranches(): Promise<string[]> {
  const { data, error } = await supabase.from('portal_profiles').select('branch').eq('is_active', true).not('branch', 'is', null);
  throwIfError(error);
  const rows = (data ?? []) as Array<{ branch: string | null }>;
  return [...new Set(rows.map((row) => String(row.branch ?? '').trim()).filter(Boolean))].sort();
}

export async function findPartMasterMatches(partNo: string): Promise<PartMasterMatch[]> {
  const value = partNo.trim();
  if (value.length < 2) return [];
  const { data, error } = await supabase.from('part_master').select('PartNo,Description').ilike('PartNo', `%${value}%`).limit(12);
  throwIfError(error);
  return ((data ?? []) as Array<{ PartNo?: string | null; Description?: string | null }>).map((row) => ({
    part_no: String(row.PartNo ?? '').trim(), description: String(row.Description ?? '').trim(),
  })).filter((row) => row.part_no);
}

export async function getExistingInstallationInvoiceNos(invoiceNos: string[]): Promise<string[]> {
  const normalized = [...new Set(invoiceNos.map((value) => value.trim().toUpperCase()).filter(Boolean))];
  if (!normalized.length) return [];
  const found: string[] = [];
  for (let index = 0; index < normalized.length; index += 150) {
    const chunk = normalized.slice(index, index + 150);
    const { data, error } = await supabase.from('portal_installation_entries').select('invoice_no').in('invoice_no', chunk);
    throwIfError(error);
    found.push(...((data ?? []) as Array<{ invoice_no?: string | null }>).map((row) => String(row.invoice_no ?? '').trim().toUpperCase()).filter(Boolean));
  }
  return [...new Set(found)];
}

export async function createInstallationEntry(input: { equipment_type: EquipmentType; invoice_date: string; branch: string; invoice_no: string; customer_name: string; items: InstallationItem[] }): Promise<string> {
  const { data, error } = await supabase.rpc('portal_create_installation_entry', {
    p_equipment_type: input.equipment_type, p_invoice_date: input.invoice_date, p_branch: input.branch,
    p_invoice_no: input.invoice_no, p_customer_name: input.customer_name, p_items: input.items,
  });
  throwIfError(error); return String(data);
}

export async function createInstallationEntriesBulk(rows: Array<{ equipment_type: EquipmentType; invoice_date: string; branch: string; invoice_no: string; customer_name: string; part_no: string; description: string; quantity: number }>) {
  const created: string[] = [];
  for (const row of rows) {
    created.push(await createInstallationEntry({
      equipment_type: row.equipment_type,
      invoice_date: row.invoice_date,
      branch: row.branch,
      invoice_no: row.invoice_no,
      customer_name: row.customer_name,
      items: [{ part_no: row.part_no, description: row.description, quantity: row.quantity }],
    }));
  }
  return created;
}

export async function uploadInstallationDocument(installationId: string, type: InstallationDocumentType, file: File) {
  const isImage = file.type.startsWith('image/');
  if (isImage && file.size < 500 * 1024) throw new Error('Image must be larger than 500 KB. Upload a clearer image.');
  if (file.size > 15 * 1024 * 1024) throw new Error('File size must not exceed 15 MB.');
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${installationId}/${type.toLowerCase()}/${Date.now()}-${safe}`;
  const { error: uploadError } = await supabase.storage.from('installation-documents').upload(path, file, { upsert: false, contentType: file.type });
  throwIfError(uploadError);
  const userResult = await supabase.auth.getUser();
  const authUserId = userResult.data.user?.id ?? '';
  const { data: profileData, error: profileError } = await supabase.from('portal_profiles').select('id').eq('auth_user_id', authUserId).maybeSingle();
  throwIfError(profileError);
  const profile = profileData as { id?: string } | null;
  const { error: deactivateError } = await supabase.from('portal_installation_documents').update({ is_active: false }).eq('installation_id', installationId).eq('document_type', type).eq('is_active', true);
  throwIfError(deactivateError);
  const { error } = await supabase.from('portal_installation_documents').insert({ installation_id: installationId, document_type: type, storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size, uploaded_by: profile?.id ?? null });
  throwIfError(error);
}

export async function getInstallationDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('installation-documents').createSignedUrl(path, 900);
  throwIfError(error);
  if (!data?.signedUrl) throw new Error('Could not create a secure document preview link.');
  return data.signedUrl;
}

export async function submitInstallationEntry(id: string, equipmentNo: string, jcbInvoiceNo: string, svrNo: string) {
  const { error } = await supabase.rpc('portal_submit_installation_entry', { p_installation_id: id, p_equipment_no: equipmentNo, p_jcb_invoice_no: jcbInvoiceNo, p_svr_no: svrNo });
  throwIfError(error);
}

export async function acceptInstallationEntry(id: string, registrationNo: string) {
  const { error } = await supabase.rpc('portal_accept_installation_entry', { p_installation_id: id, p_registration_no: registrationNo });
  throwIfError(error);
}
