import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand, getDB, anonymizeWorker } from '../lib/db';
import { User, Database, Upload, Trash2, Download, History, BadgeCheck, Mail, ShieldCheck, AlertTriangle, Fingerprint } from 'lucide-react';
import { set, del, get } from 'idb-keyval';
import type { DoctorProfile, AuditLog, Worker } from '../types';

const Settings = () => {
  const [doctor, setDoctor] = useState<DoctorProfile>({
    id: 1,
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
  const [activeTab, setActiveTab] = useState<'profile' | 'gdpr'>('profile');

  const fetchData = () => {
    const data = executeQuery<DoctorProfile>("SELECT * FROM doctor_profile WHERE id = 1");
    if (data.length > 0) {
      setDoctor(data[0]);
    }
    const auditLogs = executeQuery<AuditLog>("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50");
    setLogs(auditLogs);
    const workerList = executeQuery<Worker>("SELECT * FROM workers ORDER BY cognome ASC");
    setWorkers(workerList);
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

  const handleAnonymize = async (id: number, name: string) => {
    const confirmation = prompt(`ATTENZIONE: L'anonimizzazione di ${name} è IRREVERSIBILE. I dati personali verranno sostituiti da hash non decifrabili, mantenendo i dati clinici per obbligo di legge. Per confermare, scrivi 'ANONIMIZZA':`);
    if (confirmation === 'ANONIMIZZA') {
      try {
        await anonymizeWorker(id);
        fetchData();
        alert("Lavoratore anonimizzato con successo.");
      } catch (error) {
        console.error(error);
        alert("Errore durante l'anonimizzazione.");
      }
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight">Impostazioni Sistema</h1>
          <p className="text-gray-500 font-medium mt-2">Configurazione profilo professionale e sicurezza dati</p>
        </div>
        <div className="flex bg-warmWhite p-1.5 rounded-2xl border border-gray-100 shadow-inner">
           <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-white text-primary shadow-lg' : 'text-gray-400 hover:text-primary'}`}
           >
             Profilo & Audit
           </button>
           <button
            onClick={() => setActiveTab('gdpr')}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'gdpr' ? 'bg-white text-accent shadow-lg' : 'text-gray-400 hover:text-accent'}`}
           >
             Privacy & GDPR
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {activeTab === 'profile' ? (
            <>
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
                            <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-tighter ${log.action === 'ANONYMIZE' ? 'bg-accent/10 text-accent' : 'bg-primary/5 text-primary'}`}>
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
            </>
          ) : (
            <div className="space-y-10">
               {/* GDPR Panel */}
               <div className="glass-card rounded-[40px] overflow-hidden border-2 border-accent/5">
                  <div className="p-8 bg-accent text-white font-black flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                          <ShieldCheck size={24} />
                        </div>
                        <div>
                          <h2 className="text-lg uppercase tracking-tight">Diritto all'Oblio & Anonimizzazione</h2>
                          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-none">Conformità Regolamento UE 2016/679</p>
                        </div>
                    </div>
                  </div>

                  <div className="p-8 bg-accent/5 border-b border-accent/10">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-white rounded-2xl text-accent shadow-sm">
                        <AlertTriangle size={24} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-accent uppercase tracking-tight mb-1">Informativa Importante</h4>
                        <p className="text-[11px] font-medium text-gray-600 leading-relaxed">
                          L'anonimizzazione sostituisce irreversibilmente i dati identificativi (Nome, Cognome, Codice Fiscale, Email) con hash crittografici.
                          I dati clinici vengono mantenuti in forma anonima per il rispetto degli obblighi di conservazione quarantennale previsti dalla normativa di medicina del lavoro.
                          <strong className="block mt-2 text-accent">QUESTA AZIONE NON PUÒ ESSERE ANNULLATA.</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-0">
                    <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                      <table className="table-medical !border-none !border-spacing-y-0">
                        <thead className="sticky top-0 bg-warmWhite z-10">
                          <tr className="bg-gray-50/50 backdrop-blur-sm">
                            <th className="!py-4">Lavoratore</th>
                            <th className="!py-4">Codice Fiscale</th>
                            <th className="!py-4 text-center">Azioni GDPR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {workers.map(w => {
                            const isAnonymized = w.nome.length === 64; // SHA256 length
                            return (
                              <tr key={w.id} className="hover:bg-accent/5 transition-colors">
                                <td className="!py-4 !bg-transparent font-black text-primary text-sm">
                                  {isAnonymized ? (
                                    <div className="flex items-center gap-2 text-gray-400 italic">
                                      <Fingerprint size={14} />
                                      <span className="truncate w-32 font-mono text-[10px]">{w.nome}</span>
                                    </div>
                                  ) : (
                                    `${w.cognome} ${w.nome}`
                                  )}
                                </td>
                                <td className="!py-4 !bg-transparent font-mono text-xs text-gray-500">
                                  {isAnonymized ? "DATO ANONIMIZZATO" : w.codice_fiscale}
                                </td>
                                <td className="!py-4 !bg-transparent text-center">
                                  {!isAnonymized ? (
                                    <button
                                      onClick={() => handleAnonymize(w.id, `${w.cognome} ${w.nome}`)}
                                      className="bg-accent/10 text-accent hover:bg-accent hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-accent/20"
                                    >
                                      Anonimizza
                                    </button>
                                  ) : (
                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest flex items-center justify-center gap-1">
                                      <BadgeCheck size={12} className="text-tealAction" /> Completato
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
               </div>

               {/* Anonymization History */}
               <div className="glass-card rounded-[40px] overflow-hidden">
                  <div className="p-8 border-b border-gray-100 flex items-center gap-3">
                    <div className="p-2 bg-accent/5 rounded-xl text-accent"><History size={20} /></div>
                    <h2 className="text-base font-black text-accent uppercase tracking-tight">Log Anonimizzazioni</h2>
                  </div>
                  <div className="p-0">
                    <table className="table-medical !border-none !border-spacing-y-0">
                      <tbody className="divide-y divide-gray-50">
                        {logs.filter(l => l.action === 'ANONYMIZE').map(log => (
                          <tr key={log.id}>
                            <td className="!py-4 font-mono text-[10px] text-gray-400 w-48">{log.timestamp}</td>
                            <td className="!py-4 text-gray-600 font-bold text-xs">{log.details}</td>
                          </tr>
                        ))}
                        {logs.filter(l => l.action === 'ANONYMIZE').length === 0 && (
                          <tr>
                            <td className="p-8 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest">Nessun evento registrato</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}
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
    </div>
  );
};

export default Settings;
