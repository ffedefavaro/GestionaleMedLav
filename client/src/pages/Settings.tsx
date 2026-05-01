import React, { useState, useEffect, useCallback } from 'react';
import { getDB } from '../lib/db';
import { User, Database, Upload, Trash2, Download, History, BadgeCheck, Mail } from 'lucide-react';
import { set, del } from 'idb-keyval';
import { useAppStore } from '../store/useAppStore';

const Settings = () => {
  const { doctorProfile, auditLogs, fetchSettings, saveDoctorProfile } = useAppStore();

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

  const initData = useCallback(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    initData();
  }, [initData]);

  useEffect(() => {
    if (doctorProfile) {
      const timeout = setTimeout(() => {
        setDoctor(prev => {
          if (prev.nome === doctorProfile.nome &&
              prev.specializzazione === doctorProfile.specializzazione &&
              prev.n_iscrizione === doctorProfile.n_iscrizione &&
              prev.timbro_immagine === (doctorProfile.timbro_immagine || '')) {
            return prev;
          }
          return {
            nome: doctorProfile.nome,
            specializzazione: doctorProfile.specializzazione,
            n_iscrizione: doctorProfile.n_iscrizione,
            timbro_immagine: doctorProfile.timbro_immagine || ''
          };
        });
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [doctorProfile]);

  const saveGoogleConfig = async () => {
    await set('google_client_id', googleConfig.clientId);
    await set('google_client_secret', googleConfig.clientSecret);
    alert("Configurazione Google salvata!");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveDoctorProfile(doctor);
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
                  {auditLogs.map(log => (
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
