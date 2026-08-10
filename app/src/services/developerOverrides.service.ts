import { supabase } from '../lib/supabase';

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function developerDeleteInstallationEntry(installationId: string, reason: string) {
  const { data, error } = await supabase.rpc('portal_developer_delete_installation', {
    p_installation_id: installationId,
    p_reason: reason,
  });
  throwIfError(error);

  const paths = Array.isArray(data) ? data.map(String).filter(Boolean) : [];
  if (!paths.length) return;

  const { error: storageError } = await supabase.storage.from('installation-documents').remove(paths);
  if (storageError) {
    throw new Error(`Entry was deleted, but ${paths.length} stored document(s) could not be cleaned up automatically. ${storageError.message}`);
  }
}
