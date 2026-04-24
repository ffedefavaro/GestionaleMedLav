import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { GraduationCap, ShieldAlert, Plus, CheckCircle } from 'lucide-react';

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
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-2">
        <ShieldAlert className="text-red-600" /> Gestione Sicurezza (RSPP)
      </h1>

      <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <label className="block text-sm font-bold text-gray-700 mb-2">Seleziona Lavoratore</label>
        <select
          className="w-full md:w-1/3 border border-gray-300 rounded-lg p-2"
          value={selectedWorker}
          onChange={e => setSelectedWorker(e.target.value)}
        >
          <option value="">-- Seleziona --</option>
          {workers.map(w => <option key={w.id} value={w.id}>{w.cognome} {w.nome}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Training Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2"><GraduationCap size={20} /> Formazione</h2>
            <button onClick={() => setShowTrainingForm(true)} className="bg-blue-600 text-white p-2 rounded-lg"><Plus size={16} /></button>
          </div>

          {showTrainingForm && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3 text-sm">
              <input placeholder="Nome Corso (es. Formazione Generale)" className="w-full border p-2 rounded" value={tForm.corso} onChange={e => setTForm({...tForm, corso: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="border p-2 rounded" value={tForm.data} onChange={e => setTForm({...tForm, data: e.target.value})} />
                <input type="date" className="border p-2 rounded" value={tForm.scadenza} onChange={e => setTForm({...tForm, scadenza: e.target.value})} />
              </div>
              <button onClick={addTraining} className="w-full bg-blue-600 text-white p-2 rounded font-bold">Salva Corso</button>
            </div>
          )}

          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2">Lavoratore</th>
                  <th className="px-4 py-2">Corso</th>
                  <th className="px-4 py-2">Scadenza</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {training.map(t => (
                  <tr key={t.id}>
                    <td className="px-4 py-2">{t.cognome}</td>
                    <td className="px-4 py-2 font-medium">{t.corso}</td>
                    <td className="px-4 py-2">{t.scadenza}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PPE Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2"><CheckCircle size={20} /> DPI Assegnati</h2>
            <button onClick={() => setShowPpeForm(true)} className="bg-green-600 text-white p-2 rounded-lg"><Plus size={16} /></button>
          </div>

          {showPpeForm && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3 text-sm">
              <input placeholder="Dispositivo (es. Scarpe Antinfortunistiche)" className="w-full border p-2 rounded" value={pForm.dispositivo} onChange={e => setPForm({...pForm, dispositivo: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="border p-2 rounded" value={pForm.data} onChange={e => setPForm({...pForm, data: e.target.value})} />
                <input type="date" className="border p-2 rounded" value={pForm.scadenza} onChange={e => setPForm({...pForm, scadenza: e.target.value})} />
              </div>
              <button onClick={addPpe} className="w-full bg-green-600 text-white p-2 rounded font-bold">Salva Consegna</button>
            </div>
          )}

          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2">Lavoratore</th>
                  <th className="px-4 py-2">DPI</th>
                  <th className="px-4 py-2">Prossima Sost.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ppe.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">{p.cognome}</td>
                    <td className="px-4 py-2 font-medium">{p.dispositivo}</td>
                    <td className="px-4 py-2">{p.scadenza_sostituzione}</td>
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
