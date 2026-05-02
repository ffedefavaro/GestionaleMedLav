import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand, getDB, anonymizeWorker } from '../lib/db';
import { User, Database, Upload, Trash2, Download, History, BadgeCheck, Mail, ShieldCheck, Search, AlertTriangle } from 'lucide-react';
import { set, del, get } from 'idb-keyval';
import type { Worker, AuditLog } from '../types';

const Settings = () => {
  const [doctor, setDoctor] = useState({
    nome: '',
    specializzazione: '',
    n_iscrizione: '',
    timbro_immagine: ''
  });

  const [googleConfig, setGoogleConfig] = useState({
    clientId: '',
    clientSecret: ''
  });

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGDPRModal, setShowGDPRModal] = useState(false);
  const [workerToAnon, setWorkerToAnon] = useState<Worker | null>(null);

  const fetchData = () => {
    const data = executeQuery("SELECT * FROM doctor_profile WHERE id = 1");
    if (data.length > 0) {
      setDoctor(data[0]);
    }
    const auditLogs = executeQuery("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50") as AuditLog[];
    setLogs(auditLogs);

    const workersData = executeQuery(`
      SELECT w.*, c.ragione_sociale as azienda_ragione_sociale
      FROM workers w
      JOIN companies c ON w.company_id = c.id
      ORDER BY w.cognome, w.nome
    `) as Worker[];
    setWorkers(workersData);
  };

  useEffect(() => {
    fetchData();

    // Load Google config from IndexedDB
    const loadGoogle = async () => {
      const cid = await get('google_client_id');
      const cs = await get('google_client_secret');
      setGoogleConfig({ clientId: cid || '', clientSecret: cs || '' });
    };
    loadGoogle();
  }, []);

  const saveGoogleConfig = async () => {
    await set('google_client_id', googleConfig.clientId);
    await set('google_client_secret', googleConfig.clientSecret);
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
    fetchData();
  };

  const handleExportDB = () => {
    const db = getDB();
    if (!db) return;
    const data = db.export();
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
    reader.onload = async function() {
      const uint8Array = new Uint8Array(this.result as ArrayBuffer);
      await set('cartsan_db_v2', uint8Array);
      window.location.reload();
    };
    reader.readAsArrayBuffer(file);
  };

  const clearDB = async () => {
    const confirmation = prompt("ATTENZIONE: Questa operazione eliminerà TUTTI i dati permanentemente dal browser. Per confermare, scrivi 'CANCELLA':");
    if (confirmation === 'CANCELLA') {
      await del('cartsan_db_v2');
      window.location.reload();
    }
  };

  const handleAnonymize = async () => {
    if (!workerToAnon) return;
    try {
      await anonymizeWorker(workerToAnon.id);
      alert(`Lavoratore anonimizzato con successo.`);
      setShowGDPRModal(false);
      setWorkerToAnon(null);
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Errore durante l'anonimizzazione.");
    }
  };

  const filteredWorkers = workers.filter(w =>
    `${w.nome} ${w.cognome} ${w.codice_fiscale}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-primary tracking-tight">Impostazioni Sistema</h1>
        <p className="text-gray-500 font-medium mt-2">Configurazione profilo professionale e sicurezza dati</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Doctor Profile */}
          <div className="glass-card rounded-[40px] overflow-hidden border-2 border-primary/5">
            <div className="p-8 bg-primary text-white font-black flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg uppercase tracking-tight">Profilo Medico Competente</h2>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-none">Dati legali firma documenti</p>
                  </div>
               </div>
            </div>
            <form onSubmit={handleSaveProfile} className="p-10 space-y-8">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome e Cognome Professionale</label>
                <input
                  placeholder="es. Dott. Mario Rossi"
                  className="input-standard text-lg"
                  value={doctor.nome}
                  onChange={e => setDoctor({...doctor, nome: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Specializzazione</label>
                  <input
                    placeholder="es. Medicina del Lavoro"
                    className="input-standard"
                    value={doctor.specializzazione}
                    onChange={e => setDoctor({...doctor, specializzazione: e.target.value})}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">N. Iscrizione Ordine</label>
                  <input
                    placeholder="es. 12345 (Roma)"
                    className="input-standard font-mono"
                    value={doctor.n_iscrizione}
                    onChange={e => setDoctor({...doctor, n_iscrizione: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-6 border-t border-gray-100 flex justify-end">
                <button type="submit" className="btn-teal px-12 py-4 shadow-tealAction/20">
                   Salva Profilo Medico
                </button>
              </div>
            </form>
          </div>

          {/* Audit Log */}
          <div className="glass-card rounded-[40px] overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-primary/5 rounded-xl text-primary"><History size={20} /></div>
                 <h2 className="text-base font-black text-primary uppercase tracking-tight">Registro Tracciabilità (Audit)</h2>
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ultimi 50 eventi</span>
            </div>
            <div className="p-0 max-h-96 overflow-y-auto custom-scrollbar">
              <table className="table-medical !border-none !border-spacing-y-0">
                <thead className="sticky top-0 bg-warmWhite z-10">
                  <tr className="bg-gray-50/50 backdrop-blur-sm">
                    <th className="!py-3">Data/Ora</th>
                    <th className="!py-3">Azione</th>
                    <th className="!py-3">Dettagli Operazione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-primary/5 transition-colors">
                      <td className="!py-4 font-mono text-[10px] text-gray-400 !bg-transparent">{log.timestamp}</td>
                      <td className="!py-4 !bg-transparent">
                        <span className="bg-primary/5 text-primary px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-tighter">
                          {log.action}
                        </span>
                      </td>
                      <td className="!py-4 text-gray-600 font-bold text-xs !bg-transparent">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GDPR Privacy Section */}
          <div className="glass-card rounded-[40px] overflow-hidden border-2 border-primary/5">
            <div className="p-8 bg-tealAction text-white font-black flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h2 className="text-lg uppercase tracking-tight">Privacy e GDPR</h2>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-none">Diritto all'oblio e anonimizzazione</p>
                </div>
              </div>
            </div>
            <div className="p-10 space-y-8">
              <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                 <p className="text-xs text-primary font-bold leading-relaxed">
                   La normativa GDPR prevede il diritto all'oblio. L'anonimizzazione sostituisce i dati identificativi (Nome, Cognome, CF, Email) con codici hash irreversibili, mantenendo i dati clinici per gli obblighi legali di conservazione (40 anni).
                 </p>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-100 flex items-center gap-3">
                  <Search className="text-gray-300" size={20} />
                  <input
                    placeholder="Cerca lavoratore da anonimizzare..."
                    className="flex-1 bg-transparent outline-none text-sm font-bold placeholder:text-gray-300"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="max-h-64 overflow-y-auto custom-scrollbar border border-gray-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-black text-gray-400 uppercase">Lavoratore</th>
                        <th className="px-4 py-3 font-black text-gray-400 uppercase">Azienda</th>
                        <th className="px-4 py-3 text-right">Azione</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredWorkers.map(w => (
                        <tr key={w.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-bold text-primary">
                             {w.cognome} {w.nome}
                             <p className="text-[10px] text-gray-400 font-mono">{w.codice_fiscale}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-medium">{w.azienda_ragione_sociale}</td>
                          <td className="px-4 py-3 text-right">
                             {!w.nome.startsWith('ANON_') ? (
                               <button
                                onClick={() => { setWorkerToAnon(w); setShowGDPRModal(true); }}
                                className="p-2 text-accent hover:bg-accent/10 rounded-xl transition-all"
                                title="Anonimizza"
                               >
                                 <Trash2 size={16} />
                               </button>
                             ) : (
                               <span className="text-[9px] font-black text-tealAction uppercase">Già anonimo</span>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-10">
          {/* Google API Integration */}
          <div className="glass-card rounded-[40px] overflow-hidden border-2 border-accent/5">
            <div className="p-8 bg-accent text-white font-black flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Mail size={20} />
              </div>
              <h2 className="text-base uppercase tracking-tight">Integrazione Gmail</h2>
            </div>
            <div className="p-8 space-y-8">
              <div className="bg-white/50 p-6 rounded-3xl border border-accent/10 space-y-4">
                <h4 className="text-xs font-black text-accent uppercase tracking-widest">Istruzioni Configurazione</h4>
                <ol className="text-[11px] font-medium text-gray-600 space-y-3 list-decimal ml-4">
                  <li>
                    Vai sulla <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-accent underline font-black">Google Cloud Console</a>
                  </li>
                  <li>Crea un nuovo progetto o selezionane uno esistente.</li>
                  <li>Abilita le <strong>Gmail API</strong> dalla sezione "API e servizi".</li>
                  <li>Configura la "Schermata di consenso OAuth" (User type: External).</li>
                  <li>Crea le <strong>Credenziali</strong>: ID client OAuth 2.0 (Applicazione Web).</li>
                  <li>Aggiungi <code>https://gestionalemedlav.netlify.app</code> agli <strong>Origini JavaScript autorizzate</strong>.</li>
                </ol>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Google Client ID</label>
                  <input
                    className="input-standard font-mono text-[10px] bg-accent/5 border-accent/10 focus:ring-accent/5"
                    value={googleConfig.clientId}
                    onChange={e => setGoogleConfig({...googleConfig, clientId: e.target.value})}
                    placeholder="xxxxxx.apps.googleusercontent.com"
                  />
                </div>
              </div>
              <button
                onClick={saveGoogleConfig}
                className="btn-accent w-full py-4 shadow-2xl shadow-accent/20"
              >
                Salva Configurazione Gmail
              </button>
            </div>
          </div>

          {/* Database Management */}
          <div className="bg-sidebar rounded-[40px] p-8 text-white space-y-8 shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-white/10 rounded-xl"><Database size={20} /></div>
                <h2 className="font-black uppercase tracking-tight">Gestione Dati</h2>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleExportDB}
                  className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 p-5 rounded-2xl border border-white/10 transition-all group"
                >
                  <span className="font-bold text-sm">Esporta Backup (.sqlite)</span>
                  <Download size={18} className="text-accent group-hover:scale-110 transition-transform" />
                </button>

                <label className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 p-5 rounded-2xl border border-white/10 transition-all group cursor-pointer">
                  <span className="font-bold text-sm">Importa Database</span>
                  <Upload size={18} className="text-tealAction group-hover:scale-110 transition-transform" />
                  <input type="file" className="hidden" accept=".sqlite" onChange={handleImportDB} />
                </label>
              </div>

              <div className="mt-12 flex flex-col gap-4">
                <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-3">
                  <BadgeCheck size={18} className="text-tealAction" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Persistent Storage OK</span>
                </div>
                <button
                  onClick={clearDB}
                  className="flex items-center gap-2 text-red-600/60 hover:text-red-600 text-[10px] font-black uppercase tracking-widest transition-colors mx-auto"
                >
                  <Trash2 size={14} /> Distruggi Database Locale
                </button>
              </div>
            </div>
            {/* Design element */}
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
          </div>
        </div>
      </div>

      {/* Modal Conferma Anonimizzazione */}
      {showGDPRModal && workerToAnon && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl border border-white text-center">
            <div className="w-20 h-20 bg-accent/10 rounded-[32px] flex items-center justify-center text-accent mx-auto mb-6">
               <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-black text-primary mb-4 tracking-tight">Conferma Anonimizzazione</h3>
            <p className="text-gray-500 font-medium mb-8 leading-relaxed">
              Stai per anonimizzare <strong>{workerToAnon.cognome} {workerToAnon.nome}</strong>.<br/>
              Questa operazione è <strong>irreversibile</strong>. I dati identificativi saranno eliminati definitivamente secondo normativa GDPR.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => { setShowGDPRModal(false); setWorkerToAnon(null); }}
                className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleAnonymize}
                className="flex-[2] bg-accent text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Sì, Anonimizza Ora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
