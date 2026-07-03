export type UploadMeta = {
  at: string;
  module: 'inventory' | 'status-report';
  file: string;
  reportDate?: string;
  totalRows: number;
  validRows?: number;
  updatedRows?: number;
  failedRows: number;
  skippedRows?: number;
  batchId?: string;
};

export function readUploadMeta(key: string): UploadMeta | null {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') as UploadMeta | null;
  } catch {
    return null;
  }
}

export function saveUploadMeta(key: string, meta: UploadMeta) {
  localStorage.setItem(key, JSON.stringify(meta));
}

export function uploadProgress(step: string) {
  if (step === 'reading') return 25;
  if (step === 'server') return 65;
  if (step === 'refreshing') return 85;
  if (step === 'complete') return 100;
  if (step === 'failed') return 100;
  return 0;
}
