import { useEffect, useRef, useState } from 'react';
import { ActionLoader, FeedbackModal } from './FeedbackModal';

type LoaderVariant = 'orbit' | 'scanner' | 'comet' | 'matrix' | 'pulse';

const successWords = ['success', 'created', 'updated', 'complete', 'saved', 'signed in', 'activated', 'deactivated'];
const errorWords = ['failed', 'error', 'invalid', 'required', 'not found', 'duplicate', 'cannot', 'unauthorized', 'missing', 'expired'];
const loadingWords = ['loading', 'verifying', 'checking', 'creating', 'saving', 'activating', 'deactivating', 'processing', 'uploading'];

function clean(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function includesAny(text: string, words: string[]) { const lower = text.toLowerCase(); return words.some((word) => lower.includes(word)); }

function loaderFor(text: string): { label: string; variant: LoaderVariant } | null {
  const lower = text.toLowerCase();
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

function visibleTextFromStatusElements() {
  const elements = Array.from(document.querySelectorAll('p,span,button'));
  const statusTexts: string[] = [];
  const busyTexts: string[] = [];
  for (const element of elements) {
    if (element.closest('[data-status-effects]')) continue;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const text = clean(element.textContent || '');
    if (!text || text.length < 4 || text.length > 240) continue;
    if (includesAny(text, [...successWords, ...errorWords])) statusTexts.push(text);
    if (loaderFor(text)) busyTexts.push(text);
  }
  return { statusTexts, busyTexts };
}

export function GlobalStatusEffects() {
  const [message, setMessage] = useState('');
  const [busyText, setBusyText] = useState('');
  const closedRef = useRef(new Set<string>());

  useEffect(() => {
    const timer = window.setInterval(() => {
      fixMachineTypeDropdown();
      const { statusTexts, busyTexts } = visibleTextFromStatusElements();
      const nextMessage = statusTexts.find((text) => !closedRef.current.has(text));
      setBusyText(busyTexts[0] ?? '');
      if (nextMessage && nextMessage !== message) setMessage(nextMessage);
    }, 700);
    fixMachineTypeDropdown();
    return () => window.clearInterval(timer);
  }, [message]);

  const loader = loaderFor(busyText);

  return (
    <div data-status-effects>
      <FeedbackModal message={message} onClose={() => { if (message) closedRef.current.add(message); setMessage(''); }} />
      {loader && !message ? <div className="fixed bottom-5 right-5 z-[90] rounded-2xl border border-[#263244] bg-[#020617]/90 p-4 shadow-[0_0_40px_rgba(56,189,248,0.18)] backdrop-blur-md"><ActionLoader variant={loader.variant} label={loader.label} /></div> : null}
    </div>
  );
}
