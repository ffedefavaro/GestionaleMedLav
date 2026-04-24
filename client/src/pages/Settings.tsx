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
    <div className="p-10 max-w-5xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-primary tracking-tight">Impostazioni Sistema</h1>
        <p className="text-gray-500 font-medium mt-1">Configurazione profilo e gestione dati locali</p>
      </div>

      <div className="space-y-10">
        {/* Doctor Profile */}
        <div className="glass-card rounded-[40px] overflow-hidden">
          <div className="p-6 bg-primary/5 border-b border-primary/5 font-black text-primary flex items-center gap-3 uppercase tracking-widest text-xs">
            <User size={18} className="text-primary" strokeWidth={3} /> Profilo Medico Competente
          </div>
          <form onSubmit={handleSaveProfile} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2 col-span-full">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome e Cognome Professionale</label>
              <input
                className="input-standard font-black"
                value={doctor.nome}
                onChange={e => setDoctor({...doctor, nome: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Specializzazione</label>
              <input
                className="input-standard font-bold"
                value={doctor.specializzazione}
                onChange={e => setDoctor({...doctor, specializzazione: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">N. Iscrizione Ordine</label>
              <input
                className="input-standard font-mono"
                value={doctor.n_iscrizione}
                onChange={e => setDoctor({...doctor, n_iscrizione: e.target.value})}
              />
            </div>
            <div className="col-span-full flex justify-end mt-4">
              <button type="submit" className="btn-teal flex items-center gap-2 px-10">
                <Save size={18} strokeWidth={3} /> Aggiorna Profilo
              </button>
            </div>
          </form>
        </div>

        {/* Google API Integration */}
        <div className="glass-card rounded-[40px] overflow-hidden border-accent/20">
          <div className="p-6 bg-accent/5 border-b border-accent/10 font-black text-accent flex items-center gap-3 uppercase tracking-widest text-xs">
            <Shield size={18} strokeWidth={3} /> Integrazione Google API
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Client ID OAuth2</label>
                <input
                  className="input-standard font-mono text-xs border-accent/10"
                  value={googleConfig.clientId}
                  onChange={e => setGoogleConfig({...googleConfig, clientId: e.target.value})}
                  placeholder="xxxxxx.apps.googleusercontent.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Client Secret</label>
                <input
                  type="password"
                  className="input-standard font-mono text-xs border-accent/10"
                  value={googleConfig.clientSecret}
                  onChange={e => setGoogleConfig({...googleConfig, clientSecret: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={saveGoogleConfig}
                className="btn-accent flex items-center gap-2 px-10"
              >
                Salva Credenziali Google
              </button>
            </div>
          </div>
        </div>

        {/* Audit Log */}
        <div className="glass-card rounded-[40px] overflow-hidden">
          <div className="p-6 bg-anthracite/5 border-b border-anthracite/5 font-black text-anthracite flex items-center gap-3 uppercase tracking-widest text-xs">
            <History size={18} strokeWidth={3} /> Registro Tracciabilità (Audit)
          </div>
          <div className="p-0 max-h-64 overflow-y-auto custom-scrollbar">
            <table className="table-medical !border-none">
              <thead className="sticky top-0 bg-warmWhite z-10">
                <tr>
                  <th>Data/Ora</th>
                  <th>Azione</th>
                  <th>Dettagli Operazione</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="font-mono text-[10px] text-gray-400">{log.timestamp}</td>
                    <td><span className="bg-primary/5 text-primary px-2 py-0.5 rounded font-black text-[10px]">{log.action}</span></td>
                    <td className="text-gray-500 font-medium">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Database Management */}
        <div className="glass-card rounded-[40px] overflow-hidden border-red-600/10">
          <div className="p-6 bg-red-600/5 border-b border-red-600/5 font-black text-red-600 flex items-center gap-3 uppercase tracking-widest text-xs">
            <Database size={18} strokeWidth={3} /> Manutenzione Database Locale
          </div>
          <div className="p-8 flex flex-wrap gap-6 items-center">
            <button
              onClick={handleExportDB}
              className="flex items-center gap-3 bg-white border border-gray-100 text-primary font-black px-6 py-4 rounded-2xl shadow-lg hover:shadow-primary/5 transition-all"
            >
              <Download size={20} /> Esporta Backup (.sqlite)
            </button>

            <label className="flex items-center gap-3 bg-white border border-gray-100 text-tealAction font-black px-6 py-4 rounded-2xl shadow-lg hover:shadow-tealAction/5 transition-all cursor-pointer">
              <Upload size={20} /> Importa Database
              <input type="file" className="hidden" accept=".sqlite" onChange={handleImportDB} />
            </label>

            <button
              onClick={clearDB}
              className="flex items-center gap-3 text-red-600/40 hover:text-red-600 font-black px-6 py-4 rounded-2xl ml-auto transition-all"
            >
              <Trash2 size={20} /> Elimina Dati
            </button>
          </div>
          <div className="px-8 pb-8 flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <Shield size={12} /> Persistenza garantita su IndexedDB V2
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
