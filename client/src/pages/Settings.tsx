import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand, getDB } from '../lib/db';
import { User, Shield, Database, Save, Upload, Trash2, Download, History } from 'lucide-react';

const Settings = () => {
  const [doctor, setDoctor] = useState({
    nome: '',
    specializzazione: '',
    n_iscrizione: '',
    timbro_immagine: ''
  });

  const [googleConfig, setGoogleConfig] = useState({
    clientId: localStorage.getItem('google_client_id') || '',
    clientSecret: localStorage.getItem('google_client_secret') || ''
  });

  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const data = executeQuery("SELECT * FROM doctor_profile WHERE id = 1");
    if (data.length > 0) {
      setDoctor(data[0]);
    }
    const auditLogs = executeQuery("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50");
    setLogs(auditLogs);
  }, []);

  const saveGoogleConfig = () => {
    localStorage.setItem('google_client_id', googleConfig.clientId);
    localStorage.setItem('google_client_secret', googleConfig.clientSecret);
    alert("Configurazione Google salvata!");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const exists = executeQuery("SELECT id FROM doctor_profile WHERE id = 1");
    if (exists.length > 0) {
      await runCommand(
        "UPDATE doctor_profile SET nome = ?, specializzazione = ?, n_iscrizione = ?, timbro_immagine = ? WHERE id = 1",
        [doctor.nome, doctor.specializzazione, doctor.n_iscrizione, doctor.timbro_immagine]
      );
    } else {
      await runCommand(
        "INSERT INTO doctor_profile (id, nome, specializzazione, n_iscrizione, timbro_immagine) VALUES (1, ?, ?, ?, ?)",
        [doctor.nome, doctor.specializzazione, doctor.n_iscrizione, doctor.timbro_immagine]
      );
    }
    alert("Profilo Medico salvato!");
  };

  const handleExportDB = () => {
    const db = getDB();
    if (!db) return;
    const data = db.export();
    // Use Uint8Array directly for better compatibility
    const blob = new Blob([new Uint8Array(data)], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cartsan_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
    a.click();
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function() {
      const uint8Array = new Uint8Array(this.result as ArrayBuffer);
      localStorage.setItem('cartsan_db', JSON.stringify(Array.from(uint8Array)));
      window.location.reload();
    };
    reader.readAsArrayBuffer(file);
  };

  const clearDB = () => {
    if (confirm("ATTENZIONE: Questa operazione eliminerà TUTTI i dati permanentemente. Procedere?")) {
      localStorage.removeItem('cartsan_db');
      window.location.reload();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-8">
        <Shield className="text-blue-600" /> Impostazioni e Sicurezza
      </h1>

      <div className="space-y-8">
        {/* Doctor Profile */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 font-semibold flex items-center gap-2">
            <User size={18} className="text-blue-500" /> Profilo Medico Competente
          </div>
          <form onSubmit={handleSaveProfile} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 col-span-full">
              <label className="text-sm font-medium text-gray-600">Nome e Cognome</label>
              <input
                className="border rounded-md p-2"
                value={doctor.nome}
                onChange={e => setDoctor({...doctor, nome: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Specializzazione</label>
              <input
                className="border rounded-md p-2"
                value={doctor.specializzazione}
                onChange={e => setDoctor({...doctor, specializzazione: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">N. Iscrizione Ordine</label>
              <input
                className="border rounded-md p-2"
                value={doctor.n_iscrizione}
                onChange={e => setDoctor({...doctor, n_iscrizione: e.target.value})}
              />
            </div>
            <div className="col-span-full flex justify-end">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                <Save size={18} /> Salva Profilo
              </button>
            </div>
          </form>
        </div>

        {/* Google API Integration */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 font-semibold flex items-center gap-2">
            <Shield size={18} className="text-orange-500" /> Integrazione Google API (Gmail/Calendar)
          </div>
          <div className="p-6 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Client ID</label>
              <input
                className="border rounded-md p-2 font-mono text-xs"
                value={googleConfig.clientId}
                onChange={e => setGoogleConfig({...googleConfig, clientId: e.target.value})}
                placeholder="xxxxxx.apps.googleusercontent.com"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Client Secret</label>
              <input
                type="password"
                className="border rounded-md p-2 font-mono text-xs"
                value={googleConfig.clientSecret}
                onChange={e => setGoogleConfig({...googleConfig, clientSecret: e.target.value})}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={saveGoogleConfig}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition"
              >
                Salva Configurazione Google
              </button>
            </div>
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 font-semibold flex items-center gap-2">
            <History size={18} className="text-purple-500" /> Registro Audit (Tracciabilità Legale)
          </div>
          <div className="p-0 max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-2">Data/Ora</th>
                  <th className="px-4 py-2">Azione</th>
                  <th className="px-4 py-2">Dettagli</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">{log.timestamp}</td>
                    <td className="px-4 py-2 font-bold">{log.action}</td>
                    <td className="px-4 py-2 text-gray-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Database Management */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 font-semibold flex items-center gap-2">
            <Database size={18} className="text-green-500" /> Gestione Dati e Backup
          </div>
          <div className="p-6 flex flex-wrap gap-4">
            <button
              onClick={handleExportDB}
              className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg border border-green-200 hover:bg-green-100"
            >
              <Download size={18} /> Esporta Backup (.sqlite)
            </button>

            <label className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-100 cursor-pointer">
              <Upload size={18} /> Importa Database
              <input type="file" className="hidden" accept=".sqlite" onChange={handleImportDB} />
            </label>

            <button
              onClick={clearDB}
              className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg border border-red-200 hover:bg-red-100 ml-auto"
            >
              <Trash2 size={18} /> Elimina Tutti i Dati
            </button>
          </div>
          <div className="px-6 pb-6 text-xs text-gray-400">
            I dati vengono salvati automaticamente nel browser. Si consiglia di effettuare un backup regolare per evitare perdite di dati in caso di pulizia della cache.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
