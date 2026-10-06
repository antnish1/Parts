import { File } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';

export const INSTALLATION_SERVICE_CRM_PROFILE_ID = '9f3c378e-89d4-4427-87f2-c66061dbf3e2';
export type InstallationStatus = 'PENDING' | 'ACCEPTANCE_PENDING' | 'ACCEPTED';
export type EquipmentType = 'ENGINE' | 'ROCK_BREAKER';
export type InstallationDocumentType = 'JCB_INVOICE' | 'DBMS_INVOICE' | 'SVR';

export type InstallationItem = { id?: string; part_no: string; description: string; quantity: number };
export type InstallationDocument = { id: string; installation_id: string; document_type: InstallationDocumentType; storage_path: string; file_name: string; mime_type: string; file_size: number; uploaded_at: string; is_active: boolean };
export type InstallationEntry = {
  id: string; entry_no: string; equipment_type: EquipmentType; invoice_date: string; branch: string; invoice_no: string;
  customer_name: string; equipment_no: string | null; status: InstallationStatus; jcb_invoice_no: string | null; dbms_no: string | null;
  dbms_invoice_no: string | null; svr_no: string | null; equipment_registration_no: string | null; created_at: string;
  branch_submitted_at: string | null; accepted_at: string | null; portal_installation_items?: InstallationItem[]; portal_installation_documents?: InstallationDocument[];
};
export type InstallationInvoice = {
  id: string; invoice_date: string; jcb_invoice_no: string; part_no: string; description: string; equipment_type: EquipmentType;
  serial_no: string; dbms_no: string | null; document_path: string; document_name: string; document_mime_type: string; document_size: number;
  installation_id: string | null; created_at: string;
};
export type PartMatch = { part_no: string; description: string };
export type BranchOption = { branch_key: string; display_name: string };

const entrySelect = 'id,entry_no,equipment_type,invoice_date,branch,invoice_no,customer_name,equipment_no,status,jcb_invoice_no,dbms_no,dbms_invoice_no,svr_no,equipment_registration_no,created_at,branch_submitted_at,accepted_at,portal_installation_items(id,part_no,description,quantity),portal_installation_documents(id,installation_id,document_type,storage_path,file_name,mime_type,file_size,uploaded_at,is_active)';
const allowedMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const normalize = (value: string | null | undefined) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_');

export function canManageInstallations(profile: UserProfile | null | undefined) {
  if (!profile) return false;
  return ['admin', 'manager', 'developer', 'hq'].includes(profile.role) || normalize(profile.branch) === 'JABALPUR_PARTS';
}
export function canViewInstallations(profile: UserProfile | null | undefined) { return Boolean(profile && profile.role !== 'accounts'); }
export function canCompleteInstallation(profile: UserProfile | null | undefined, entry: InstallationEntry | null | undefined) {
  if (!profile || !entry) return false;
  return ['admin', 'manager', 'developer', 'hq'].includes(profile.role) || normalize(profile.branch) === normalize(entry.branch);
}
export function isInstallationServiceCrm(profile: UserProfile | null | undefined) { return profile?.id === INSTALLATION_SERVICE_CRM_PROFILE_ID; }
export function installationStatusLabel(status: InstallationStatus) { return status === 'ACCEPTANCE_PENDING' ? 'Acceptance Pending' : status === 'ACCEPTED' ? 'Accepted' : 'Pending'; }
export function equipmentTypeLabel(type: EquipmentType) { return type === 'ROCK_BREAKER' ? 'Rock Breaker' : 'Engine'; }

export async function listInstallationEntries(): Promise<InstallationEntry[]> {
  const { data, error } = await supabase.from('portal_installation_entries').select(entrySelect).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InstallationEntry[];
}
export async function getInstallationEntry(id: string): Promise<InstallationEntry> {
  const { data, error } = await supabase.from('portal_installation_entries').select(entrySelect).eq('id', id).single();
  if (error) throw error;
  return data as unknown as InstallationEntry;
}
export async function listInstallationInvoices(): Promise<InstallationInvoice[]> {
  const { data, error } = await supabase.from('portal_installation_invoices').select('id,invoice_date,jcb_invoice_no,part_no,description,equipment_type,serial_no,dbms_no,document_path,document_name,document_mime_type,document_size,installation_id,created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InstallationInvoice[];
}
export async function getInstallationInvoice(id: string): Promise<InstallationInvoice> {
  const { data, error } = await supabase.from('portal_installation_invoices').select('id,invoice_date,jcb_invoice_no,part_no,description,equipment_type,serial_no,dbms_no,document_path,document_name,document_mime_type,document_size,installation_id,created_at').eq('id', id).single();
  if (error) throw error;
  return data as unknown as InstallationInvoice;
}
export async function listInstallationBranches(): Promise<BranchOption[]> {
  const { data, error } = await supabase.from('portal_branches').select('branch_key,display_name').eq('is_active', true).order('sort_order').order('display_name');
  if (error) throw error;
  return (data ?? []) as BranchOption[];
}
export async function findInstallationPart(partNo: string): Promise<PartMatch | null> {
  const value = partNo.trim().toUpperCase();
  if (!value) return null;
  const { data, error } = await supabase.from('part_master').select('PartNo,Description').ilike('PartNo', value).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { part_no: String(data.PartNo ?? '').trim(), description: String(data.Description ?? '').trim() };
}

export async function findInstallationParts(term: string): Promise<PartMatch[]> {
  const value = term.trim();
  if (value.length < 2) return [];
  const { data, error } = await supabase.from('part_master').select('PartNo,Description').ilike('PartNo', `%${value}%`).limit(12);
  if (error) throw error;
  return ((data ?? []) as Array<{ PartNo?: string | null; Description?: string | null }>)
    .map((row) => ({ part_no: String(row.PartNo ?? '').trim(), description: String(row.Description ?? '').trim() }))
    .filter((row) => row.part_no);
}

function validateAsset(asset: DocumentPickerAsset, requireClearImage = false) {
  const mime = asset.mimeType || 'application/octet-stream';
  if (!allowedMime.includes(mime)) throw new Error('Upload a PDF, JPG, PNG or WEBP file.');
  const size = Number(asset.size ?? 0);
  if (size > 15 * 1024 * 1024) throw new Error('File size must not exceed 15 MB.');
  if (requireClearImage && mime.startsWith('image/') && size > 0 && size < 500 * 1024) throw new Error('Image must be larger than 500 KB. Upload a clearer image.');
}
async function uploadAsset(bucket: string, path: string, asset: DocumentPickerAsset) {
  const file = new File(asset.uri);
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: asset.mimeType || 'application/octet-stream', upsert: false });
  if (error) throw error;
}

export async function createInstallationInvoice(input: { invoiceDate: string; jcbInvoiceNo: string; partNo: string; description: string; equipmentType: EquipmentType; serialNo: string; dbmsNo: string; asset: DocumentPickerAsset }) {
  validateAsset(input.asset);
  const safe = input.asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `invoice-intake/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
  await uploadAsset('installation-documents', path, input.asset);
  const { data, error } = await supabase.rpc('portal_create_installation_invoice', {
    p_invoice_date: input.invoiceDate, p_jcb_invoice_no: input.jcbInvoiceNo.trim(), p_part_no: input.partNo.trim(), p_description: input.description.trim(),
    p_equipment_type: input.equipmentType, p_serial_no: input.serialNo.trim(), p_dbms_no: input.dbmsNo.trim(), p_document_path: path,
    p_document_name: input.asset.name, p_document_mime_type: input.asset.mimeType || 'application/octet-stream', p_document_size: Number(input.asset.size ?? 0),
  });
  if (error) { await supabase.storage.from('installation-documents').remove([path]); throw error; }
  return String(data);
}

export async function registerFromInvoice(input: { invoiceId: string; branch: string; customerName: string; quantity: number }) {
  const { data, error } = await supabase.rpc('portal_create_installation_from_invoice', { p_invoice_id: input.invoiceId, p_branch: input.branch, p_customer_name: input.customerName.trim(), p_quantity: input.quantity });
  if (error) throw error;
  return String(data);
}

export async function uploadInstallationDocument(installationId: string, type: InstallationDocumentType, asset: DocumentPickerAsset) {
  validateAsset(asset, true);
  const safe = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${installationId}/${type.toLowerCase()}/${Date.now()}-${safe}`;
  await uploadAsset('installation-documents', path, asset);
  const { data: userData } = await supabase.auth.getUser();
  const authId = userData.user?.id ?? '';
  const { data: profile } = await supabase.from('portal_profiles').select('id').eq('auth_user_id', authId).maybeSingle();
  const { error: deactivateError } = await supabase.from('portal_installation_documents').update({ is_active: false }).eq('installation_id', installationId).eq('document_type', type).eq('is_active', true);
  if (deactivateError) { await supabase.storage.from('installation-documents').remove([path]); throw deactivateError; }
  const { error } = await supabase.from('portal_installation_documents').insert({ installation_id: installationId, document_type: type, storage_path: path, file_name: asset.name, mime_type: asset.mimeType || 'application/octet-stream', file_size: Number(asset.size ?? 0), uploaded_by: profile?.id ?? null });
  if (error) { await supabase.storage.from('installation-documents').remove([path]); throw error; }
}
export async function getInstallationDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from('installation-documents').createSignedUrl(path, 900);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Could not create secure document link.');
  return data.signedUrl;
}
export async function submitInstallationEntry(id: string, equipmentNo: string, jcbInvoiceNo: string, dbmsInvoiceNo: string, svrNo: string) {
  const { error } = await supabase.rpc('portal_submit_installation_entry', { p_installation_id: id, p_equipment_no: equipmentNo.trim(), p_jcb_invoice_no: jcbInvoiceNo.trim(), p_dbms_invoice_no: dbmsInvoiceNo.trim(), p_svr_no: svrNo.trim() });
  if (error) throw error;
}
export async function acceptInstallationEntry(id: string, registrationNo: string) {
  const { error } = await supabase.rpc('portal_accept_installation_entry', { p_installation_id: id, p_registration_no: registrationNo.trim() });
  if (error) throw error;
}


export async function developerDeleteInstallationEntry(installationId: string, reason: string) {
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) throw new Error('Enter a clear deletion reason.');
  const { data, error } = await supabase.rpc('portal_developer_delete_installation', {
    p_installation_id: installationId,
    p_reason: cleanReason,
  });
  if (error) throw error;

  const paths = Array.isArray(data) ? data.map(String).filter(Boolean) : [];
  if (!paths.length) return;
  const { error: storageError } = await supabase.storage.from('installation-documents').remove(paths);
  if (storageError) {
    throw new Error(`Entry was deleted, but ${paths.length} stored document(s) could not be cleaned up automatically. ${storageError.message}`);
  }
}
