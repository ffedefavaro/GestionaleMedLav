import React, { useRef, useEffect } from 'react';
import SignaturePad from 'signature_pad';

interface SignatureInputProps {
  label: string;
  onSave: (dataUrl: string) => void;
  clearTrigger?: unknown;
}

const SignatureInput: React.FC<SignatureInputProps> = ({ label, onSave, clearTrigger }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      signaturePadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)'
      });

      const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          canvas.getContext("2d")?.scale(ratio, ratio);
          signaturePadRef.current?.clear();
        }
      };

      window.addEventListener("resize", resizeCanvas);
      resizeCanvas();

      return () => {
        window.removeEventListener("resize", resizeCanvas);
      };
    }
  }, []);

  useEffect(() => {
    if (clearTrigger) {
      signaturePadRef.current?.clear();
    }
  }, [clearTrigger]);

  const handleSave = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      onSave(signaturePadRef.current.toDataURL());
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
      <div className="border-2 border-gray-100 rounded-2xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => signaturePadRef.current?.clear()}
          className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-accent"
        >
          Cancella
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="text-[10px] font-black text-tealAction uppercase tracking-widest hover:underline"
        >
          Conferma Firma
        </button>
      </div>
    </div>
  );
};

export default SignatureInput;
