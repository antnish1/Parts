import { useEffect, useState } from 'react';
import { ActionLoader } from './FeedbackModal';

type LoaderVariant = 'orbit' | 'scanner' | 'comet' | 'matrix' | 'pulse';

const loadingWords = ['verifying', 'checking', 'creating', 'saving', 'activating', 'deactivating', 'processing', 'uploading'];
const ignoredBusyTexts = ['loading orders', 'loading order', 'approved orders', 'track orders', 'order tracking workspace'];

function clean(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function includesAny(text: string, words: string[]) { const lower = text.toLowerCase(); return words.some((word) => lower.includes(word)); }

function loaderFor(text: string): { label: string; variant: LoaderVariant } | null {
  const lower = text.toLowerCase();
  if (ignoredBusyTexts.some((word) => lower.includes(word))) return null;
  if (!includesAny(lower, loadingWords)) return null;
  if (lower.includes('order')) return { label: 'Building order stream', variant: 'matrix' };
  if (lower.includes('comment')) return { label: 'Scanning comments', variant: 'scanner' };
  if (lower.includes('login') || lower.includes('session') || lower.includes('verifying')) return { label: 'Authenticating gateway', variant: 'comet' };
  if (lower.includes('profile') || lower.includes('user')) return { label: 'Syncing user core', variant: 'pulse' };
  if (lower.includes('upload')) return { label: 'Uploading data capsule', variant: 'scanner' };
  return { label: clean(text).slice(0, 44), variant: 'orbit' };
}

function fixMachineTypeDropdown() {
  const selects = Array.from(document.querySelectorAll('select'));
  for (const select of selects) {
    const optionText = Array.from(select.options).map((option) => option.textContent || '').join(' ');
    if (!optionText.includes('Backhoe Loader') && !optionText.includes('Select Machine Type')) continue;
    const current = select.value;
    select.innerHTML = '<option value="">Select U/W or B/W</option><option value="U/W">U/W</option><option value="B/W">B/W</option>';
    if (current === 'U/W' || current === 'B/W') select.value = current;
    else select.value = '';
  }
}

function visibleBusyText() {
  const elements = Array.from(document.querySelectorAll('p,span,button'));
  for (const element of elements) {
    if (element.closest('[data-status-effects]')) continue;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const text = clean(element.textContent || '');
    if (!text || text.length < 4 || text.length > 160) continue;
    if (loaderFor(text)) return text;
  }
  return '';
}

export function GlobalStatusEffects() {
  const [busyText, setBusyText] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => {
      fixMachineTypeDropdown();
      setBusyText(visibleBusyText());
    }, 700);
    fixMachineTypeDropdown();
    return () => window.clearInterval(timer);
  }, []);

  const loader = loaderFor(busyText);

  return (
    <div data-status-effects>
      {loader ? <div className="fixed left-3 right-3 top-24 z-[90] rounded-2xl border border-[#263244] bg-[#020617]/92 p-4 shadow-[0_0_40px_rgba(56,189,248,0.18)] backdrop-blur-md sm:left-auto sm:right-5 sm:top-auto sm:bottom-5 sm:w-auto"><ActionLoader variant={loader.variant} label={loader.label} /></div> : null}
    </div>
  );
}
