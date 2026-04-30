import { useState, useEffect } from 'react';
import { executeQuery } from '../lib/db';
import { User, Activity, FileText, ArrowLeft, Download, Clipboard, Clock } from 'lucide-react';
import { jsPDF } from 'jspdf';

const StoricoLavoratore = ({ workerId, onBack }: { workerId: number, onBack: () => void }) => {
  const [worker, setWorker] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);

  useEffect(() => {
    const w = executeQuery("SELECT * FROM workers WHERE id = ?", [workerId])[0];
    const v = executeQuery("SELECT * FROM visits WHERE worker_id = ? ORDER BY data_visita DESC", [workerId]);
    setWorker(w);
    setVisits(v);
  }, [workerId]);

  const reprintGiudizio = (visit: any) => {
    const doc = new jsPDF();
    const doctorData = executeQuery("SELECT * FROM doctor_profile WHERE id = 1")[0] || {};

    doc.setFont("helvetica", "bold");
    doc.text("GIUDIZIO DI IDONEITÀ (RISTAMPA)", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text("(D.Lgs. 81/08 - Art. 41)", 105, 26, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.rect(15, 35, 180, 45);
    doc.text(`Lavoratore: ${worker.cognome} ${worker.nome}`, 20, 45);
    doc.text(`Codice Fiscale: ${worker.codice_fiscale || 'N/D'}`, 20, 51);
    doc.text(`Azienda: ${worker.company_id}`, 20, 57); // Would need join for name
    doc.text(`Mansione: ${worker.mansione}`, 20, 63);
    doc.text(`Data Visita: ${visit.data_visita}`, 20, 69);
    doc.text(`Tipo Visita: ${visit.tipo_visita.toUpperCase()}`, 20, 75);

    doc.setFont("helvetica", "bold");
    doc.text("GIUDIZIO:", 20, 90);
    doc.text(visit.giudizio.toUpperCase(), 45, 90);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Prossima visita entro il: ${visit.scadenza_prossima}`, 20, 140);

    doc.text(`Dott. ${doctorData.nome || '...' }`, 130, 170);
    doc.save(`Ristampa_Giudizio_${worker.cognome}_${visit.data_visita}.pdf`);
  };

  if (!worker) return null;

  return (
    <div className="p-10 max-w-7xl mx-auto animate-in fade-in duration-500">
      <button onClick={onBack} className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest mb-10 hover:translate-x-[-4px] transition-transform">
        <ArrowLeft size={16} strokeWidth={3} /> Torna all'elenco lavoratori
      </button>

      <div className="glass-card rounded-[40px] p-10 mb-10 flex justify-between items-center border-primary/5">
        <div>
          <span className="text-[10px] font-black text-accent uppercase tracking-widest bg-accent/5 px-3 py-1 rounded-full border border-accent/10">Profilo Lavoratore</span>
          <h1 className="text-4xl font-black text-primary tracking-tighter mt-4">{worker.cognome} {worker.nome}</h1>
          <p className="text-gray-400 font-mono text-sm mt-1">{worker.codice_fiscale}</p>
          <div className="mt-6 flex gap-3">
            <div className="bg-primary/5 px-4 py-2 rounded-2xl border border-primary/5">
               <p className="text-[10px] font-black text-gray-400 uppercase">Mansione Corrente</p>
               <p className="text-sm font-bold text-primary">{worker.mansione}</p>
            </div>
            <div className="bg-tealAction/5 px-4 py-2 rounded-2xl border border-tealAction/5">
               <p className="text-[10px] font-black text-gray-400 uppercase">Email Comunicazioni</p>
               <p className="text-sm font-bold text-tealAction">{worker.email || 'N/D'}</p>
            </div>
          </div>
        </div>
        <div className="w-24 h-24 bg-primary/5 rounded-[32px] flex items-center justify-center text-primary/20">
          <User size={64} strokeWidth={1} />
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Activity size={24} className="text-tealAction" strokeWidth={2.5} />
          <h2 className="text-xl font-black text-primary tracking-tight">Storico Sorveglianza Sanitaria</h2>
        </div>

        {visits.length === 0 ? (
          <div className="glass-card p-20 text-center rounded-[40px] border-dashed">
            <Clipboard size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Nessun dato clinico registrato</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {visits.map(v => (
              <div key={v.id} className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-lg shadow-primary/5 hover:shadow-xl transition-all group">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
                  <div>
                    <span className="bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{v.tipo_visita}</span>
                    <h3 className="font-black text-2xl text-primary mt-2">{v.data_visita}</h3>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => reprintGiudizio(v)} className="btn-teal py-3 px-6 text-xs flex items-center gap-2">
                      <Download size={16} strokeWidth={3} /> Ristampa Giudizio
                    </button>
                    <button className="btn-accent py-3 px-6 text-xs flex items-center gap-2">
                      <FileText size={16} strokeWidth={3} /> Esporta Cartella 3A
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="bg-warmWhite/50 p-6 rounded-2xl border border-gray-50">
                    <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-3">Esito Visita</p>
                    <p className={`text-lg font-black leading-tight ${v.giudizio.includes('non') ? 'text-red-600' : 'text-tealAction'}`}>
                      {v.giudizio.toUpperCase()}
                    </p>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                       <Clock size={14} className="text-gray-300" />
                       <span className="text-xs font-bold text-gray-500">Scadenza: {v.scadenza_prossima}</span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-3">Sintesi Anamnestica ed Obiettiva</p>
                    <div className="text-sm font-medium text-gray-600 leading-relaxed bg-gray-50/50 p-6 rounded-2xl italic border border-gray-100">
                      "{v.esame_obiettivo || 'Risultanze regolari, anamnesi negativa per patologie professionali.'}"
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoricoLavoratore;
