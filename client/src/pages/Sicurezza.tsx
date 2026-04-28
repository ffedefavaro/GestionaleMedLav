import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { GraduationCap, Plus, User, Package } from 'lucide-react';

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
      ORDER BY training_records.scadenza ASC
    `));
    setPpe(executeQuery(`
      SELECT ppe_assigned.*, workers.nome, workers.cognome
      FROM ppe_assigned
      JOIN workers ON ppe_assigned.worker_id = workers.id
      ORDER BY ppe_assigned.scadenza_sostituzione ASC
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
    setTForm({ corso: '', data: '', scadenza: '' });
    fetchData();
  };

  const addPpe = async () => {
    if (!selectedWorker || !pForm.dispositivo) return;
    await runCommand(
      "INSERT INTO ppe_assigned (worker_id, dispositivo, data_consegna, scadenza_sostituzione) VALUES (?, ?, ?, ?)",
      [selectedWorker, pForm.dispositivo, pForm.data, pForm.scadenza]
    );
    setShowPpeForm(false);
    setPForm({ dispositivo: '', data: '', scadenza: '' });
    fetchData();
  };

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-primary tracking-tight">Gestione Sicurezza (RSPP)</h1>
        <p className="text-gray-500 font-medium mt-1">Monitoraggio formazione obbligatoria e DPI</p>
      </div>

      <div className="mb-10 glass-card p-8 rounded-[40px] flex flex-col md:flex-row items-center gap-6">
        <div className="bg-primary/5 p-4 rounded-2xl text-primary">
          <User size={32} />
        </div>
        <div className="flex-1 w-full">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-2">Lavoratore di Riferimento</label>
          <select
            className="w-full input-standard font-black text-primary text-lg"
            value={selectedWorker}
            onChange={e => setSelectedWorker(e.target.value)}
          >
            <option value="">-- Seleziona dalla lista --</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.cognome} {w.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Training Section */}
        <div className="space-y-8">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-2xl font-black text-primary flex items-center gap-3">
              <div className="p-2 bg-tealAction/10 rounded-xl text-tealAction"><GraduationCap size={24} /></div>
              Formazione
            </h2>
            <button
              onClick={() => setShowTrainingForm(!showTrainingForm)}
              className="btn-teal !p-3 !rounded-2xl shadow-tealAction/10"
              disabled={!selectedWorker}
            >
              <Plus size={20} strokeWidth={3} />
            </button>
          </div>

          {showTrainingForm && (
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[32px] border border-gray-100 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tipologia Corso</label>
                <input placeholder="es. Antincendio Rischio Medio" className="input-standard w-full" value={tForm.corso} onChange={e => setTForm({...tForm, corso: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Conseguimento</label>
                  <input type="date" className="input-standard" value={tForm.data} onChange={e => setTForm({...tForm, data: e.target.value})} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Scadenza</label>
                  <input type="date" className="input-standard text-tealAction" value={tForm.scadenza} onChange={e => setTForm({...tForm, scadenza: e.target.value})} />
                </div>
              </div>
              <button onClick={addTraining} className="btn-teal w-full py-5 text-base shadow-2xl">Registra Certificato</button>
            </div>
          )}

          <div className="glass-card rounded-[40px] overflow-hidden p-2">
            <table className="table-medical">
              <thead>
                <tr>
                  <th>Lavoratore</th>
                  <th>Corso / Abilitazione</th>
                  <th className="text-right">Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {training.map(t => (
                  <tr key={t.id} className="group">
                    <td className="font-black text-primary">{t.cognome}</td>
                    <td>
                      <div className="text-gray-600 font-bold text-sm">{t.corso}</div>
                      <div className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">Conseguito: {t.data}</div>
                    </td>
                    <td className="text-right">
                       <span className="bg-tealAction/5 text-tealAction px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border border-tealAction/10">
                        {t.scadenza}
                       </span>
                    </td>
                  </tr>
                ))}
                {training.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-10 text-gray-300 italic">Nessun record di formazione</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PPE Section */}
        <div className="space-y-8">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-2xl font-black text-primary flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-xl text-accent"><Package size={24} /></div>
              DPI Assegnati
            </h2>
            <button
              onClick={() => setShowPpeForm(!showPpeForm)}
              className="btn-accent !p-3 !rounded-2xl shadow-accent/10"
              disabled={!selectedWorker}
            >
              <Plus size={20} strokeWidth={3} />
            </button>
          </div>

          {showPpeForm && (
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[32px] border border-gray-100 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dispositivo di Protezione</label>
                <input placeholder="es. Guanti Dielettrici Classe 0" className="input-standard w-full" value={pForm.dispositivo} onChange={e => setPForm({...pForm, dispositivo: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Consegna</label>
                  <input type="date" className="input-standard" value={pForm.data} onChange={e => setPForm({...pForm, data: e.target.value})} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Revisione / Sostituzione</label>
                  <input type="date" className="input-standard text-accent" value={pForm.scadenza} onChange={e => setPForm({...pForm, scadenza: e.target.value})} />
                </div>
              </div>
              <button onClick={addPpe} className="btn-accent w-full py-5 text-base shadow-2xl">Registra Consegna DPI</button>
            </div>
          )}

          <div className="glass-card rounded-[40px] overflow-hidden p-2">
            <table className="table-medical">
              <thead>
                <tr>
                  <th>Lavoratore</th>
                  <th>Dispositivo (DPI)</th>
                  <th className="text-right">Revisione</th>
                </tr>
              </thead>
              <tbody>
                {ppe.map(p => (
                  <tr key={p.id}>
                    <td className="font-black text-primary">{p.cognome}</td>
                    <td>
                      <div className="text-gray-600 font-bold text-sm">{p.dispositivo}</div>
                      <div className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">Consegnato: {p.data}</div>
                    </td>
                    <td className="text-right">
                       <span className="bg-accent/5 text-accent px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border border-accent/10">
                        {p.scadenza_sostituzione}
                       </span>
                    </td>
                  </tr>
                ))}
                {ppe.length === 0 && (
                   <tr><td colSpan={3} className="text-center py-10 text-gray-300 italic">Nessun DPI consegnato</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sicurezza;
