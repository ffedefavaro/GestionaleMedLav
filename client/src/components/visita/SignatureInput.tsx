import React, { useRef, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import { Trash2 } from 'lucide-react';

interface SignatureInputProps {
  label: string;
  onSave: (signature: string) => void;
}

export const SignatureInput: React.FC<SignatureInputProps> = ({ label, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      signaturePadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: 'rgb(30, 41, 59)'
      });

      const resizeCanvas = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        if (canvasRef.current) {
          canvasRef.current.width = canvasRef.current.offsetWidth * ratio;
          canvasRef.current.height = canvasRef.current.offsetHeight * ratio;
          canvasRef.current.getContext("2d")?.scale(ratio, ratio);
          signaturePadRef.current?.clear();
        }
      };

      window.addEventListener("resize", resizeCanvas);
      resizeCanvas();

      return () => window.removeEventListener("resize", resizeCanvas);
    }
  }, []);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    onSave('');
  };

  const handleConfirm = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const dataUrl = signaturePadRef.current.toDataURL();
      onSave(dataUrl);
    }
  };

  return (
    <div className="space-y-4">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">{label}</label>
      <div className="relative bg-warmWhite/30 border-2 border-dashed border-gray-100 rounded-3xl overflow-hidden group">
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair"
          onMouseUp={handleConfirm}
          onTouchEnd={handleConfirm}
        />
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleClear}
            className="p-2 bg-white text-red-500 rounded-xl shadow-lg hover:bg-red-50 transition-colors"
            title="Cancella Firma"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
