import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { GraduationCap, Plus, CheckCircle } from 'lucide-react';

const Sicurezza = () => {
  const [workers, setWorkers] = useState<any[]>([]);
  const [training, setTraining] = useState<any[]>([]);
  const [ppe, setPpe] = useState<any[]>([]);

  const [selectedWorker, setSelectedWorker] = useState('');
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [showPpeForm, setShowPpeForm] = useState(false);

  const [tForm, setTForm] = useState({ corso: '', data: '', scadenza: '' });
  const [pForm, setPForm] = useState({ dispositivo: '', data: '', scadenza: '' });

  const fetchData = () => {
    setWorkers(executeQuery("SELECT id, nome, cognome FROM workers ORDER BY cognome"));
    setTraining(executeQuery(`
      SELECT training_records.*, workers.nome, workers.cognome
      FROM training_records
      JOIN workers ON training_records.worker_id = workers.id
    `));
    setPpe(executeQuery(`
      SELECT ppe_assigned.*, workers.nome, workers.cognome
      FROM ppe_assigned
      JOIN workers ON ppe_assigned.worker_id = workers.id
    `));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addTraining = async () => {
    if (!selectedWorker || !tForm.corso) return;
    await runCommand(
      "INSERT INTO training_records (worker_id, corso, data_completamento, scadenza) VALUES (?, ?, ?, ?)",
      [selectedWorker, tForm.corso, tForm.data, tForm.scadenza]
    );
    setShowTrainingForm(false);
    fetchData();
  };

  const addPpe = async () => {
    if (!selectedWorker || !pForm.dispositivo) return;
    await runCommand(
      "INSERT INTO ppe_assigned (worker_id, dispositivo, data_consegna, scadenza_sostituzione) VALUES (?, ?, ?, ?)",
      [selectedWorker, pForm.dispositivo, pForm.data, pForm.scadenza]
    );
    setShowPpeForm(false);
    fetchData();
  };

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-primary tracking-tight">Gestione Sicurezza (RSPP)</h1>
        <p className="text-gray-500 font-medium mt-1">Monitoraggio formazione e DPI</p>
      </div>

      <div className="mb-10 glass-card p-8 rounded-[32px]">
        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 block mb-3">Lavoratore di Riferimento</label>
        <select
          className="w-full md:w-1/2 input-standard font-black text-primary"
          value={selectedWorker}
          onChange={e => setSelectedWorker(e.target.value)}
        >
          <option value="">-- Seleziona dalla lista --</option>
          {workers.map(w => <option key={w.id} value={w.id}>{w.cognome} {w.nome}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Training Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xl font-black text-primary flex items-center gap-3"><GraduationCap size={24} className="text-tealAction" /> Formazione</h2>
            <button onClick={() => setShowTrainingForm(!showTrainingForm)} className="btn-teal p-2 rounded-xl"><Plus size={20} strokeWidth={3} /></button>
          </div>

          {showTrainingForm && (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-4">
              <input placeholder="Nome Corso (es. Antincendio Rischio Medio)" className="input-standard w-full" value={tForm.corso} onChange={e => setTForm({...tForm, corso: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Corso</label>
                  <input type="date" className="input-standard" value={tForm.data} onChange={e => setTForm({...tForm, data: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Scadenza</label>
                  <input type="date" className="input-standard" value={tForm.scadenza} onChange={e => setTForm({...tForm, scadenza: e.target.value})} />
                </div>
              </div>
              <button onClick={addTraining} className="btn-teal w-full py-4 text-sm uppercase tracking-widest">Registra Certificato</button>
            </div>
          )}

          <div className="glass-card rounded-[32px] overflow-hidden p-2">
            <table className="table-medical">
              <thead>
                <tr>
                  <th>Lavoratore</th>
                  <th>Corso</th>
                  <th>Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {training.map(t => (
                  <tr key={t.id}>
                    <td className="font-black text-primary">{t.cognome}</td>
                    <td className="text-gray-600 font-medium">{t.corso}</td>
                    <td className="text-xs font-black text-tealAction">{t.scadenza}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PPE Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xl font-black text-primary flex items-center gap-3"><CheckCircle size={24} className="text-accent" /> DPI Assegnati</h2>
            <button onClick={() => setShowPpeForm(!showPpeForm)} className="btn-accent p-2 rounded-xl"><Plus size={20} strokeWidth={3} /></button>
          </div>

          {showPpeForm && (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-4">
              <input placeholder="Dispositivo (es. Guanti Dielettrici)" className="input-standard w-full" value={pForm.dispositivo} onChange={e => setPForm({...pForm, dispositivo: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Consegna</label>
                  <input type="date" className="input-standard" value={pForm.data} onChange={e => setPForm({...pForm, data: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sostituzione</label>
                  <input type="date" className="input-standard" value={pForm.scadenza} onChange={e => setPForm({...pForm, scadenza: e.target.value})} />
                </div>
              </div>
              <button onClick={addPpe} className="btn-accent w-full py-4 text-sm uppercase tracking-widest">Registra Consegna</button>
            </div>
          )}

          <div className="glass-card rounded-[32px] overflow-hidden p-2">
            <table className="table-medical">
              <thead>
                <tr>
                  <th>Lavoratore</th>
                  <th>DPI</th>
                  <th>Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {ppe.map(p => (
                  <tr key={p.id}>
                    <td className="font-black text-primary">{p.cognome}</td>
                    <td className="text-gray-600 font-medium">{p.dispositivo}</td>
                    <td className="text-xs font-black text-accent">{p.scadenza_sostituzione}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sicurezza;
