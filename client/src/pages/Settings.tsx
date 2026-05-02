import { useState, useEffect } from 'react';
import {
  User, Mail, History, Database, Download, Upload, Trash2,
  Settings as SettingsIcon, AlertTriangle, ShieldCheck, RefreshCw, Send, Save
} from 'lucide-react';
import { executeQuery, runCommand, getDB } from '../lib/db';
import { saveAs } from 'file-saver';
import { get, set, del } from 'idb-keyval';
import { useAppStore } from '../store/useAppStore';
import { checkEmailConfiguration, sendEmailViaGmail } from '../lib/emailService';
import type { EmailTemplate, EmailLog } from '../types';

const Settings = () => {
  const { setEmailConfig, isEmailConfigured, senderEmail } = useAppStore();
  const [doctor, setDoctor] = useState({ nome: '', specializzazione: '', n_iscrizione: '' });
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [googleConfig, setGoogleConfig] = useState({ clientId: '' });
  const [emailSettings, setEmailSettings] = useState({
    senderName: '',
    automaticReminders: false
  });
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
    loadEmailConfig();
  }, []);

  const loadEmailConfig = async () => {
    const { configured, email } = await checkEmailConfiguration();
    setEmailConfig(configured, email);

    const sName = await get('sender_name') || '';
    const autoRem = await get('automatic_reminders') || false;
    setEmailSettings({ senderName: sName, automaticReminders: autoRem });

    const clientId = await get('google_client_id') || '';
    setGoogleConfig({ clientId });

    const temps = executeQuery("SELECT * FROM email_templates") as EmailTemplate[];
    setTemplates(temps);

    const eLogs = executeQuery("SELECT * FROM email_logs ORDER BY data_ora DESC LIMIT 50") as EmailLog[];
    setEmailLogs(eLogs);
  };

  const fetchData = () => {
    const data = executeQuery("SELECT * FROM doctor_profile WHERE id = 1") as { nome: string, specializzazione: string, n_iscrizione: string }[];
    if (data.length > 0) {
      setDoctor(data[0]);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCommand(
      "INSERT OR REPLACE INTO doctor_profile (id, nome, specializzazione, n_iscrizione) VALUES (1, ?, ?, ?)",
      [doctor.nome, doctor.specializzazione, doctor.n_iscrizione]
    );
    alert("Profilo medico aggiornato!");
    fetchData();
  };

  const saveGoogleConfig = async () => {
    await set('google_client_id', googleConfig.clientId);
    alert("Client ID salvato correttamente!");
  };

  const handleGmailAuth = async () => {
    if (!googleConfig.clientId) {
      alert("Configura prima il Client ID di Google.");
      return;
    }

    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: googleConfig.clientId,
        scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.access_token) {
            await set('google_access_token', response.access_token);

            // Get user email
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` }
            });
            const info = await res.json();
            if (info.email) {
              await set('sender_email', info.email);
              await loadEmailConfig();
            }
          }
        },
      });
      client.requestAccessToken();
    } catch (e) {
      console.error(e);
      alert("Errore durante l'autenticazione Google.");
    }
  };

  const saveEmailSettings = async () => {
    await set('sender_name', emailSettings.senderName);
    await set('automatic_reminders', emailSettings.automaticReminders);

    for (const temp of templates) {
      await runCommand(
        "UPDATE email_templates SET soggetto = ?, corpo = ? WHERE tipo = ?",
        [temp.soggetto, temp.corpo, temp.tipo]
      );
    }

    alert("Impostazioni comunicazioni salvate!");
  };

  const handleTestEmail = async () => {
    if (!senderEmail) return;
    setLoading(true);
    const success = await sendEmailViaGmail(
      senderEmail,
      "Email di Test — CartSan Lean",
      "Questa è una email di test inviata dal sistema CartSan Lean per verificare la configurazione."
    );
    setLoading(true);
    if (success) {
      setLoading(false);
      alert("Email di test inviata con successo!");
      loadEmailConfig();
    } else {
      setLoading(false);
      alert("Invio email di test fallito. Controlla la console o il registro comunicazioni.");
    }
  };

  const handleExportDB = () => {
    const db = getDB();
    if (!db) return;
    const data = db.export();
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
    saveAs(blob, `cartsan_backup_${new Date().toISOString().split('T')[0]}.sqlite`);
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const data = new Uint8Array(reader.result as ArrayBuffer);
      await set('cartsan_db_v2', data);
      window.location.reload();
    };
    reader.readAsArrayBuffer(file);
  };

  const clearDB = async () => {
    const confirm = prompt("Per confermare la distruzione del database, scrivi 'CANCELLA':");
    if (confirm === 'CANCELLA') {
      await del('cartsan_db_v2');
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto font-['DM_Sans']">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-primary tracking-tight">Impostazioni Sistema</h1>
        <p className="text-gray-500 font-medium mt-1">Configurazione legale e sicurezza dati</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Email Communications */}
          <div className="glass-card rounded-[40px] overflow-hidden border-2 border-primary/5">
            <div className="p-8 bg-tealAction text-white font-black flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg uppercase tracking-tight">Comunicazioni Automatiche</h2>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-none">Gmail API & Template</p>
                  </div>
               </div>
               {isEmailConfigured && (
                 <button onClick={handleTestEmail} disabled={loading} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] uppercase tracking-widest border border-white/20 transition-all flex items-center gap-2">
                   {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Invia Test
                 </button>
               )}
            </div>

            <div className="p-10 space-y-10">
              {!isEmailConfigured ? (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-[32px] p-6 flex items-start gap-4 animate-pulse">
                   <AlertTriangle className="text-amber-600 mt-1" size={24} />
                   <div className="flex-1">
                      <p className="text-amber-800 font-black text-sm uppercase tracking-tight">Email mittente non configurata</p>
                      <p className="text-amber-700 text-xs font-medium mt-1">Le comunicazioni automatiche sono disattivate. Autorizza l'app ad inviare email tramite il tuo account Google.</p>
                      <button onClick={handleGmailAuth} className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-colors">Configura Ora</button>
                   </div>
                </div>
              ) : (
                <div className="bg-tealAction/5 border-2 border-tealAction/10 rounded-[32px] p-6 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-tealAction/10 rounded-2xl text-tealAction"><ShieldCheck size={24} /></div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Email Attiva</p>
                        <p className="text-primary font-black">{senderEmail}</p>
                      </div>
                   </div>
                   <button onClick={handleGmailAuth} className="text-[10px] font-black text-primary/40 uppercase tracking-widest hover:text-primary transition-colors underline">Cambia Account</button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Mittente Visualizzato</label>
                  <input
                    placeholder="es. Dr. Federico - Medico Competente"
                    className="input-standard"
                    value={emailSettings.senderName}
                    onChange={e => setEmailSettings({...emailSettings, senderName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Reminder Automatici</label>
                  <div className="flex items-center gap-4 h-[54px] bg-warmWhite/50 px-6 rounded-2xl border border-gray-100">
                     <span className={`text-xs font-bold ${!isEmailConfigured ? 'text-gray-300' : 'text-primary/60'}`}>Attiva invio automatico</span>
                     <button
                        disabled={!isEmailConfigured}
                        onClick={() => setEmailSettings({...emailSettings, automaticReminders: !emailSettings.automaticReminders})}
                        className={`ml-auto w-12 h-6 rounded-full transition-all relative ${emailSettings.automaticReminders ? 'bg-tealAction' : 'bg-gray-200'} ${!isEmailConfigured ? 'opacity-30 cursor-not-allowed' : ''}`}
                        title={!isEmailConfigured ? "Configura prima l'email mittente" : ""}
                     >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${emailSettings.automaticReminders ? 'translate-x-6' : ''}`} />
                     </button>
                  </div>
                </div>
              </div>

              {/* Email Templates */}
              <div className="space-y-8 pt-6 border-t border-gray-100">
                <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Template Personalizzabili</h3>
                <div className="grid grid-cols-1 gap-10">
                  {templates.map((temp, idx) => (
                    <div key={temp.tipo} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="bg-primary/5 text-primary px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-tighter">
                          {temp.tipo === 'reminder' ? 'Promemoria Scadenza' : 'Invio Giudizio'}
                        </span>
                        <p className="text-[9px] text-gray-400 font-bold italic">Variabili: {temp.tipo === 'reminder' ? '{nome_lavoratore}, {data_visita}, {azienda}, {medico}' : '{nome_lavoratore}, {data_visita}, {azienda}, {giudizio}, {medico}'}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Oggetto</label>
                        <input
                          className="input-standard"
                          value={temp.soggetto}
                          onChange={e => {
                            const nt = [...templates];
                            nt[idx].soggetto = e.target.value;
                            setTemplates(nt);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Corpo Messaggio</label>
                        <textarea
                          className="input-standard h-32 text-sm leading-relaxed"
                          value={temp.corpo}
                          onChange={e => {
                            const nt = [...templates];
                            nt[idx].corpo = e.target.value;
                            setTemplates(nt);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <button onClick={saveEmailSettings} className="btn-teal px-12 py-4 flex items-center gap-3">
                   <Save size={20} /> Salva Configurazione Comunicazioni
                </button>
              </div>
            </div>
          </div>

          {/* Communication Logs */}
          <div className="glass-card rounded-[40px] overflow-hidden border-2 border-primary/5">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-primary/5 rounded-xl text-primary"><History size={20} /></div>
                 <h2 className="text-base font-black text-primary uppercase tracking-tight">Registro Comunicazioni (Email)</h2>
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ultimi 50 invii</span>
            </div>
            <div className="p-0 max-h-96 overflow-y-auto custom-scrollbar">
              <table className="table-medical !border-none !border-spacing-y-0">
                <thead className="sticky top-0 bg-warmWhite z-10">
                  <tr className="bg-gray-50/50 backdrop-blur-sm">
                    <th className="!py-3">Data/Ora</th>
                    <th className="!py-3">Destinatario</th>
                    <th className="!py-3">Oggetto</th>
                    <th className="!py-3">Esito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {emailLogs.map(log => (
                    <tr key={log.id} className="hover:bg-primary/5 transition-colors">
                      <td className="!py-4 font-mono text-[10px] text-gray-400 !bg-transparent">{log.data_ora}</td>
                      <td className="!py-4 text-primary font-black text-[10px] !bg-transparent">{log.destinatario}</td>
                      <td className="!py-4 text-gray-600 font-bold text-[10px] truncate max-w-[200px] !bg-transparent">{log.oggetto}</td>
                      <td className="!py-4 !bg-transparent">
                        <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-tighter ${
                          log.esito === 'successo' ? 'bg-tealAction/10 text-tealAction' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {log.esito}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {emailLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-gray-400 text-[10px] uppercase font-black tracking-widest italic">Nessun invio registrato</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-10">
          {/* Doctor Profile */}
          <div className="glass-card rounded-[40px] overflow-hidden border-2 border-primary/5">
            <div className="p-8 bg-primary text-white font-black flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <User size={20} />
                  </div>
                  <h2 className="text-base uppercase tracking-tight">Profilo Medico</h2>
               </div>
            </div>
            <form onSubmit={handleSaveProfile} className="p-8 space-y-6">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Nome Professionale</label>
                <input
                  className="input-standard !py-3"
                  value={doctor.nome}
                  onChange={e => setDoctor({...doctor, nome: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Specializzazione</label>
                <input
                  className="input-standard !py-3"
                  value={doctor.specializzazione}
                  onChange={e => setDoctor({...doctor, specializzazione: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">N. Iscrizione</label>
                <input
                  className="input-standard !py-3 font-mono"
                  value={doctor.n_iscrizione}
                  onChange={e => setDoctor({...doctor, n_iscrizione: e.target.value})}
                />
              </div>
              <button type="submit" className="btn-teal w-full py-3 text-xs">Salva Profilo</button>
            </form>
          </div>

          {/* Google Client ID Integration */}
          <div className="glass-card rounded-[40px] overflow-hidden border-2 border-accent/5">
            <div className="p-8 bg-accent text-white font-black flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <SettingsIcon size={20} />
              </div>
              <h2 className="text-base uppercase tracking-tight">Integrazione Gmail</h2>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Google Client ID</label>
                <input
                  className="input-standard font-mono text-[10px] bg-accent/5 border-accent/10 focus:ring-accent/5"
                  value={googleConfig.clientId}
                  onChange={e => setGoogleConfig({...googleConfig, clientId: e.target.value})}
                  placeholder="xxxxxx.apps.googleusercontent.com"
                />
              </div>
              <button
                onClick={saveGoogleConfig}
                className="btn-accent w-full py-4 shadow-2xl shadow-accent/20"
              >
                Salva Client ID
              </button>
            </div>
          </div>

          {/* Database Management */}
          <div className="bg-sidebar rounded-[40px] p-8 text-white space-y-8 shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-white/10 rounded-xl"><Database size={20} /></div>
                <h2 className="font-black uppercase tracking-tight text-xs">Gestione Dati</h2>
              </div>
              <div className="space-y-4">
                <button onClick={handleExportDB} className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 transition-all">
                  <span className="font-bold text-xs">Esporta Backup</span>
                  <Download size={16} className="text-accent" />
                </button>
                <label className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 transition-all cursor-pointer">
                  <span className="font-bold text-xs">Importa Database</span>
                  <Upload size={16} className="text-tealAction" />
                  <input type="file" className="hidden" accept=".sqlite" onChange={handleImportDB} />
                </label>
              </div>
              <div className="mt-8">
                <button onClick={clearDB} className="flex items-center gap-2 text-red-600/60 hover:text-red-600 text-[9px] font-black uppercase tracking-widest transition-colors mx-auto">
                  <Trash2 size={12} /> Distruggi Database Locale
                </button>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
