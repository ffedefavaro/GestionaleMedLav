import { useState, useEffect } from 'react';
import { executeQuery } from '../lib/db';
import { User, Activity, FileText, ArrowLeft, Download } from 'lucide-react';
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
    <div className="p-8">
      <button onClick={onBack} className="flex items-center gap-2 text-blue-600 mb-6 hover:underline">
        <ArrowLeft size={18} /> Torna all'elenco
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{worker.cognome} {worker.nome}</h1>
          <p className="text-gray-500 font-mono text-sm">{worker.codice_fiscale}</p>
          <div className="mt-2 flex gap-4 text-xs font-medium">
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">Mansione: {worker.mansione}</span>
            <span className="bg-green-50 text-green-700 px-2 py-1 rounded">Email: {worker.email}</span>
          </div>
        </div>
        <User size={48} className="text-gray-200" />
      </div>

      <div className="space-y-6">
        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
          <Activity size={20} className="text-blue-500" /> Storico Visite e Cartella Sanitaria
        </h2>

        {visits.length === 0 ? (
          <div className="bg-white p-12 text-center text-gray-400 border border-dashed rounded-xl">
            Nessuna visita registrata per questo lavoratore.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {visits.map(v => (
              <div key={v.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:border-blue-200 transition">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{v.tipo_visita}</span>
                    <h3 className="font-bold text-lg text-gray-800">{v.data_visita}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => reprintGiudizio(v)} className="flex items-center gap-1 text-xs bg-gray-50 hover:bg-gray-100 border p-2 rounded-lg transition">
                      <Download size={14} /> Giudizio
                    </button>
                    <button className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 p-2 rounded-lg transition">
                      <FileText size={14} /> Cartella 3A
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div>
                    <p className="text-gray-400 font-bold text-[10px] uppercase mb-1">Giudizio</p>
                    <p className={`font-bold ${v.giudizio.includes('non') ? 'text-red-600' : 'text-green-700'}`}>{v.giudizio.toUpperCase()}</p>
                    <p className="text-xs text-gray-500 mt-1">Scadenza: {v.scadenza_prossima}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-400 font-bold text-[10px] uppercase mb-1">Anamnesi e Obiettivo</p>
                    <p className="text-gray-600 italic line-clamp-2">"{v.esame_obiettivo || 'Regolare'}"</p>
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
