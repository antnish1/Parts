import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';

type SignaturePadProps = {
  title: string;
  subtitle: string;
  agreement: string;
  value: string;
  onChange: (value: string) => void;
};

export function SignaturePad({ title, subtitle, agreement, value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  function getPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasInk(true);
  }

  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const dataUrl = event.currentTarget.toDataURL('image/png');
    onChange(dataUrl);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange('');
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">{title}</p>
          <h3 className="mt-1 text-base font-black text-slate-950">{subtitle}</h3>
        </div>
        <div className={`rounded-full px-3 py-1 text-[11px] font-black ${hasInk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {hasInk ? 'Signed' : 'Required'}
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-xs font-semibold leading-5 text-slate-700">
        <ShieldCheck className="mr-2 inline h-4 w-4 text-blue-600" />
        {agreement}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-[linear-gradient(#ffffff,#ffffff),repeating-linear-gradient(0deg,transparent,transparent_31px,#e2e8f0_32px)] shadow-inner">
        <canvas
          ref={canvasRef}
          className="h-48 w-full touch-none cursor-crosshair bg-transparent"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold text-slate-500">Sign slowly inside the box. Use Clear if signature is not proper.</p>
        <Button type="button" variant="secondary" className="shrink-0 px-3 py-2 text-xs" onClick={clearSignature}>
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
    </section>
  );
}
