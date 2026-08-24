import { supabase } from '../lib/supabase';
import type { ParsedPartPriceFile, ParsedPartPriceRow } from './partPriceExcelParser';

export type PartPricePreviewRow = {
  partNo: string;
  description?: string | null;
  oldDnp?: number | null;
  newDnp?: number | null;
  oldRtl?: number | null;
  newRtl?: number | null;
  oldMrp?: number | null;
  newMrp?: number | null;
};

export type PartPricePreview = {
  uploadId: string;
  currentParts: number;
  stagedParts: number;
  newParts: number;
  changedParts: number;
  unchangedParts: number;
  removedParts: number;
  publishBlocked: boolean;
  warnings: string[];
  changedSample: PartPricePreviewRow[];
  newSample: PartPricePreviewRow[];
  removedSample: PartPricePreviewRow[];
};

export type PriceListUploadSummary = {
  id: string;
  priceListMonth: string;
  filename: string;
  status: string;
  validRows: number;
  publishedAt: string | null;
  uploadedAt: string;
};

const CHUNK_SIZE = 2000;

function unwrap<T>(data: T | null, error: { message?: string } | null, fallback: string): T {
  if (error) throw new Error(error.message || fallback);
  if (!data) throw new Error(fallback);
  if (typeof data === 'object' && data !== null && 'error' in data && (data as { error?: unknown }).error) {
    throw new Error(String((data as { error?: unknown }).error));
  }
  return data;
}

export async function stagePartPriceFile(
  parsed: ParsedPartPriceFile,
  fileName: string,
  priceListMonth: string,
  onProgress?: (completed: number, total: number) => void,
) {
  const { data: startData, error: startError } = await supabase.rpc('portal_start_part_master_upload', {
    p_price_list_month: priceListMonth,
    p_filename: fileName,
    p_total_rows: parsed.totalRows,
    p_valid_rows: parsed.validRows.length,
    p_invalid_rows: parsed.invalidRows,
    p_duplicate_rows: parsed.duplicateRows,
  });
  const started = unwrap(startData as { uploadId?: string } | null, startError, 'Unable to start price list upload.');
  const uploadId = String(started.uploadId ?? '');
  if (!uploadId) throw new Error('Price list upload session did not return an upload ID.');

  for (let offset = 0; offset < parsed.validRows.length; offset += CHUNK_SIZE) {
    const chunk: ParsedPartPriceRow[] = parsed.validRows.slice(offset, offset + CHUNK_SIZE);
    const { data, error } = await supabase.rpc('portal_stage_part_master_chunk', {
      p_upload_id: uploadId,
      p_rows: chunk,
    });
    unwrap(data as Record<string, unknown> | null, error, `Unable to stage price list rows ${offset + 1}-${offset + chunk.length}.`);
    onProgress?.(Math.min(offset + chunk.length, parsed.validRows.length), parsed.validRows.length);
  }

  return uploadId;
}

function mapPreview(data: Record<string, unknown>): PartPricePreview {
  return {
    uploadId: String(data.uploadId ?? ''),
    currentParts: Number(data.currentParts ?? 0),
    stagedParts: Number(data.stagedParts ?? 0),
    newParts: Number(data.newParts ?? 0),
    changedParts: Number(data.changedParts ?? 0),
    unchangedParts: Number(data.unchangedParts ?? 0),
    removedParts: Number(data.removedParts ?? 0),
    publishBlocked: Boolean(data.publishBlocked),
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
    changedSample: Array.isArray(data.changedSample) ? data.changedSample as PartPricePreviewRow[] : [],
    newSample: Array.isArray(data.newSample) ? data.newSample as PartPricePreviewRow[] : [],
    removedSample: Array.isArray(data.removedSample) ? data.removedSample as PartPricePreviewRow[] : [],
  };
}

export async function previewPartPriceUpload(uploadId: string) {
  const { data, error } = await supabase.rpc('portal_preview_part_master_upload', { p_upload_id: uploadId });
  return mapPreview(unwrap(data as Record<string, unknown> | null, error, 'Unable to preview price list upload.'));
}

export async function publishPartPriceUpload(uploadId: string) {
  const { data, error } = await supabase.rpc('portal_publish_part_master_upload', { p_upload_id: uploadId });
  return unwrap(data as Record<string, unknown> | null, error, 'Unable to publish price list upload.');
}

export async function discardPartPriceUpload(uploadId: string) {
  const { data, error } = await supabase.rpc('portal_discard_part_master_upload', { p_upload_id: uploadId });
  return unwrap(data as Record<string, unknown> | null, error, 'Unable to discard price list upload.');
}

export async function getRecentPartPriceUploads(): Promise<PriceListUploadSummary[]> {
  const { data, error } = await supabase.rpc('portal_list_part_master_uploads', { p_limit: 6 });
  const rows = unwrap(data as Record<string, unknown>[] | null, error, 'Unable to load price list upload history.');
  return rows.map((row) => ({
    id: String(row.id ?? ''),
    priceListMonth: String(row.priceListMonth ?? ''),
    filename: String(row.filename ?? ''),
    status: String(row.status ?? ''),
    validRows: Number(row.validRows ?? 0),
    publishedAt: row.publishedAt ? String(row.publishedAt) : null,
    uploadedAt: String(row.uploadedAt ?? ''),
  }));
}
