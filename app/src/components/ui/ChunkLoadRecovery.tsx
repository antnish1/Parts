import { Component, type ErrorInfo, type ReactNode } from 'react';

const RECOVERY_KEY = 'parts-connect-chunk-recovery';

function isChunkError(value: unknown) {
  const message = value instanceof Error ? messageWithCause(value) : String(value ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [^ ]+ failed|Failed to load module script|error loading dynamically imported module/i.test(message);
}

function messageWithCause(error: Error) {
  return [error.message, String((error as Error & { cause?: unknown }).cause ?? '')].join(' ');
}

function recoverFromStaleChunk() {
  try {
    // Only reload once per failed URL within five minutes, preventing a reload loop.
    const current = `${location.pathname}${location.search}`;
    const last = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) ?? 'null') as { path: string; at: number } | null;
    if (last?.path === current && Date.now() - last.at < 5 * 60_000) return false;
    sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ path: current, at: Date.now() }));
  } catch {
    // Navigation recovery still works when storage is disabled.
  }
  location.reload();
  return true;
}

type State = { failed: boolean };
export class ChunkLoadRecovery extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(error: Error): State {
    return { failed: isChunkError(error) };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (isChunkError(error)) {
      recoverFromStaleChunk();
    } else {
      // Other rendering exceptions should not trigger an automatic reload.
      console.error('Parts Connect route render failed', error);
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-8 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-800">
        <p className="font-semibold">This page needs the latest application files.</p>
        <p className="mt-2 text-sm text-slate-500">Your existing work has not been changed.</p>
        <button type="button" className="mt-4 rounded-lg bg-blue-900 px-4 py-2 text-sm font-bold text-white" onClick={() => location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}

export function installChunkLoadRecovery() {
  window.addEventListener('vite:preloadError', (event) => {
    if (isChunkError((event as Event & { payload?: unknown }).payload)) {
      event.preventDefault();
      recoverFromStaleChunk();
    }
  });
}
