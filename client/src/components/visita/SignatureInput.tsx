import { useRef, useEffect } from 'react';
import SignaturePad from 'signature_pad';

interface SignatureInputProps {
  onSave: (base64: string) => void;
  label: string;
}

export const SignatureInput = ({ onSave, label }: SignatureInputProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      padRef.current = new SignaturePad(canvasRef.current);
    }
  }, []);

  const clear = () => padRef.current?.clear();
  const save = () => {
    if (padRef.current && !padRef.current.isEmpty()) {
      onSave(padRef.current.toDataURL());
    }
  };

  return (
    <div className="space-y-4">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
      <div className="border-2 border-gray-100 rounded-3xl overflow-hidden bg-warmWhite/30">
        <canvas ref={canvasRef} className="w-full h-40" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={clear} className="text-[10px] font-bold text-gray-400 uppercase hover:text-accent transition-colors">Cancella</button>
        <button type="button" onClick={save} className="text-[10px] font-bold text-tealAction uppercase hover:underline ml-auto">Conferma Firma</button>
      </div>
    </div>
  );
};
