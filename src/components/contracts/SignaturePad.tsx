// Drawing a signature.
//
// A finger on a phone or a mouse on a laptop. The drawing is kept as a PNG data
// URL and stored with the signature evidence, alongside the typed name route.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

interface Props {
  onChange: (dataUrl: string | null) => void;
  height?: number;
}

const SignaturePad = ({ onChange, height = 160 }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth ?? 480;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#26306b";
  }, [height]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (empty) setEmpty(false);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {/* A sheet of paper with a signing line. */}
      <div className="relative border-2 border-navy bg-white shadow-[5px_5px_0_hsl(var(--navy))]">
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-9 border-b-2 border-navy/25" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-6 text-[11px] font-extrabold uppercase tracking-[0.14em] text-navy/50">
          Sign here
        </span>
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[38px] left-2 text-[18px] font-black text-navy/30">×</span>
        <canvas
          ref={canvasRef}
          className="relative touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] text-body">
          {empty ? "Sign inside the box using your finger or mouse." : "Happy with it? Continue below."}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={empty}>
          <Eraser className="mr-2 h-3.5 w-3.5" />Clear
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
