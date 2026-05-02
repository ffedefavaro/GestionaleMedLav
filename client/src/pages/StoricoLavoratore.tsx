import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { executeQuery } from '../lib/db';
import { FileText, ChevronRight, Clock } from 'lucide-react';
import type { Worker, Visit } from '../types';

interface StoricoLavoratoreProps {
  workerId?: number;
  onBack?: () => void;
}

const StoricoLavoratore = ({ workerId: propWorkerId, onBack }: StoricoLavoratoreProps) => {
  const { workerId: paramWorkerId } = useParams();
  const effectiveWorkerId = propWorkerId || paramWorkerId;
  const [worker, setWorker] = useState<Worker | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);

  useEffect(() => {
    if (!effectiveWorkerId) return;
    const w = executeQuery("SELECT * FROM workers WHERE id = ?", [effectiveWorkerId])[0] as Worker;
    const v = executeQuery("SELECT * FROM visits WHERE worker_id = ? ORDER BY data_visita DESC", [effectiveWorkerId]) as Visit[];
    setWorker(w);
    setVisits(v);
  }, [effectiveWorkerId]);

  if (!worker) return <div className="p-20 text-center font-black uppercase text-gray-400">Caricamento...</div>;

  return (
    <div className="p-10 max-w-5xl mx-auto font-['DM_Sans']">
      {onBack && (
        <button onClick={onBack} className="mb-6 text-primary font-black uppercase text-xs flex items-center gap-2 hover:translate-x-1 transition-transform">
          ← Torna all'elenco
        </button>
      )}
      <div className="flex items-center gap-6 mb-12">
        <div className="w-20 h-20 bg-primary rounded-[32px] flex items-center justify-center text-white text-2xl font-black shadow-2xl shadow-primary/20">
          {worker.nome[0]}{worker.cognome[0]}
        </div>
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">{worker.cognome} {worker.nome}</h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">{worker.mansione} | {worker.codice_fiscale}</p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-accent/10 rounded-xl text-accent"><Clock size={20} /></div>
          <h2 className="text-lg font-black text-primary uppercase tracking-tight">Timeline Sorveglianza</h2>
        </div>

        {visits.map((visit) => (
          <div key={visit.id} className="glass-card p-8 rounded-[40px] flex items-center justify-between group hover:scale-[1.01] transition-all border-2 border-transparent hover:border-primary/5 shadow-xl shadow-primary/5">
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data</span>
                <span className="text-sm font-black text-primary bg-primary/5 px-4 py-2 rounded-2xl">{visit.data_visita}</span>
              </div>

              <div className="h-10 w-[2px] bg-gray-100" />

              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo Visita</span>
                <span className="text-xs font-bold text-gray-600 uppercase tracking-tight">{visit.tipo_visita}</span>
              </div>

              <div className="h-10 w-[2px] bg-gray-100" />

              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Giudizio</span>
                <span className={`text-xs font-black uppercase tracking-tight ${
                  visit.giudizio === 'idoneo' ? 'text-tealAction' : 'text-accent'
                }`}>{visit.giudizio}</span>
              </div>
            </div>

            <button className="w-12 h-12 rounded-2xl bg-warmWhite flex items-center justify-center text-gray-300 group-hover:bg-primary group-hover:text-white transition-all shadow-lg shadow-primary/5">
              <ChevronRight size={24} />
            </button>
          </div>
        ))}

        {visits.length === 0 && (
          <div className="p-20 text-center border-4 border-dashed border-gray-100 rounded-[60px]">
            <FileText size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Nessuna visita in archivio</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoricoLavoratore;
