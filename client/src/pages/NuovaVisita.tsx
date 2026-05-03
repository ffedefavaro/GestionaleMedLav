import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { User, Clipboard, Activity, CheckCircle, Download, Mail, RefreshCw, Heart, Weight, Ruler, Wind, Stethoscope, FileText, Printer, X } from 'lucide-react';
import { exportPDF, type Worker, type Visit } from '../lib/pdfGenerator';
import { fetchGmailMessages, type GmailMessage } from '../lib/gmail';
import { fetchGmailAttachments } from '../lib/attachments';
import { get } from 'idb-keyval';
import WorkerSearch from '../components/WorkerSearch';

const NuovaVisita = () => {
  const [lavoratori, setLavoratori] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  const [step, setStep] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);

  // Gmail State
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [visitForm, setVisitForm] = useState<Visit>({
    data_visita: new Date().toISOString().split('T')[0],
    tipo_visita: 'periodica',
    anamnesi_lavorativa: '',
    anamnesi_familiare: '',
    anamnesi_patologica: '',
    giudizio: 'idoneo',
    prescrizioni: '',
    accertamenti_effettuati: '',
    scadenza_prossima: '',
    // Biometrics
    peso: 70,
    altezza: 170,
    p_sistolica: 120,
    p_diastolica: 80,
    frequenza: 70,
    spo2: 98,
    // Structured Physical Exam
    eo_cardiaca: '',
    eo_respiratoria: '',
    eo_cervicale: '',
    eo_dorsolombare: '',
    eo_spalle: '',
    eo_arti_superiori: '',
    eo_arti_inferiori: '',
    eo_altro: ''
  });

  const fetchWorkers = () => {
    const data = executeQuery(`
      SELECT workers.id, workers.nome, workers.cognome, workers.mansione, workers.email, workers.codice_fiscale, companies.ragione_sociale as azienda
      FROM workers
      JOIN companies ON workers.company_id = companies.id
    `);
    setLavoratori(data);
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (selectedWorkerId) {
      const data = lavoratori.find(l => l.id.toString() === selectedWorkerId);
      if (data) {
        setWorkerData(data);

        const fullWorker = executeQuery(`
          SELECT workers.*, protocols.periodicita_mesi as protocol_periodicity
          FROM workers
          LEFT JOIN protocols ON workers.protocol_id = protocols.id
          WHERE workers.id = ?
        `, [selectedWorkerId])[0] as any;

        if (fullWorker) {
          let months = (fullWorker.protocol_periodicity as number) || 12;
          if (fullWorker.is_protocol_customized && fullWorker.custom_protocol) {
            try {
              const customExams = JSON.parse(fullWorker.custom_protocol);
              if (customExams.length > 0) {
                months = Math.min(...customExams.map((e: { periodicita?: number }) => e.periodicita || 12));
              }
            } catch (e) {
              console.error("Error parsing custom protocol", e);
            }
          }

          const nextDate = new Date();
          nextDate.setMonth(nextDate.getMonth() + months);
          setVisitForm(prev => ({...prev, scadenza_prossima: nextDate.toISOString().split('T')[0]}));
        }
      }
    } else {
      setWorkerData(null);
    }
  }, [selectedWorkerId, lavoratori]);

  const handleAuthAndFetch = async () => {
    const clientId = await get('google_client_id');
    if (!clientId) {
      alert("Configura il Client ID nelle impostazioni prima di usare Gmail.");
      return;
    }

    setLoadingGmail(true);
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: async (response: any) => {
          if (response.access_token && workerData?.email) {
            setAccessToken(response.access_token);
            const msgs = await fetchGmailMessages(response.access_token, workerData.email);
            setGmailMessages(msgs);
          }
          setLoadingGmail(false);
        },
      });
      client.requestAccessToken();
    } catch (e) {
      console.error(e);
      setLoadingGmail(false);
    }
  };

  const importEmailText = async (msg: GmailMessage) => {
    let textToImport = `--- EMAIL del ${msg.date} ---\n${msg.body}\n`;

    if (accessToken) {
      const attachments = await fetchGmailAttachments(accessToken, msg.id);
      attachments.forEach(att => {
        if (att.extractedText) {
          textToImport += `\n--- ALLEGATO: ${att.filename} ---\n${att.extractedText}\n`;
        }
      });
    }

    setVisitForm(prev => ({
      ...prev,
      anamnesi_patologica: prev.anamnesi_patologica + (prev.anamnesi_patologica ? "\n\n" : "") + textToImport
    }));
    alert("Testo e allegati importati in Anamnesi Patologica!");
  };

  const handleSave = async () => {
    // 1. Insert Visit with structured exam fields
    await runCommand(`
      INSERT INTO visits (
        worker_id, data_visita, tipo_visita, anamnesi_lavorativa, anamnesi_familiare, anamnesi_patologica,
        accertamenti_effettuati, eo_cardiaca, eo_respiratoria, eo_cervicale, eo_dorsolombare,
        eo_spalle, eo_arti_superiori, eo_arti_inferiori, eo_altro, giudizio, prescrizioni, scadenza_prossima, finalized
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      selectedWorkerId, visitForm.data_visita, visitForm.tipo_visita,
      visitForm.anamnesi_lavorativa, visitForm.anamnesi_familiare, visitForm.anamnesi_patologica,
      visitForm.accertamenti_effettuati, visitForm.eo_cardiaca, visitForm.eo_respiratoria,
      visitForm.eo_cervicale, visitForm.eo_dorsolombare, visitForm.eo_spalle,
      visitForm.eo_arti_superiori, visitForm.eo_arti_inferiori, visitForm.eo_altro,
      visitForm.giudizio, visitForm.prescrizioni, visitForm.scadenza_prossima
    ]);

    const lastVisitData = executeQuery("SELECT id FROM visits ORDER BY id DESC LIMIT 1")[0];

    // Log action for legal audit
    await runCommand(
      "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
      ["FINALIZE", "visits", lastVisitData.id, `Visita finalizzata per lavoratore ID: ${selectedWorkerId}`]
    );

    // 2. Insert Biometrics
    if (lastVisitData) {
      const bmi = visitForm.peso / ((visitForm.altezza/100) ** 2);
      await runCommand(`
        INSERT INTO biometrics (visit_id, peso, altezza, bmi, pressione_sistolica, pressione_diastolica, frequenza_cardiaca, spo2)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [lastVisitData.id, visitForm.peso, visitForm.altezza, bmi, visitForm.p_sistolica, visitForm.p_diastolica, visitForm.frequenza, visitForm.spo2]);
    }

    alert("Visita salvata con successo!");
    setShowExportModal(true);
  };

  const handleCloseVisit = () => {
    setShowExportModal(false);
    setStep(1);
    setSelectedWorkerId('');
  };

  const handleExport = (mode: 'completa' | 'giudizio' | 'entrambi') => {
    if (!workerData) return;
    const doctorData = executeQuery("SELECT * FROM doctor_profile WHERE id = 1")[0] || {};
    exportPDF(mode, workerData, visitForm, doctorData);
  };

  const calculateBMI = () => {
    if (visitForm.peso && visitForm.altezza) {
      return (visitForm.peso / ((visitForm.altezza / 100) ** 2)).toFixed(1);
    }
    return '--';
  };

  return (
    <div className="p-10 max-w-5xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black text-primary tracking-tight">Esecuzione Visita Medica</h1>
        <p className="text-gray-500 font-medium mt-1">Conformità D.Lgs 81/08 - Allegato 3A</p>
      </div>

      <div className="flex items-center mb-12 px-10">
        {[
          { step: 1, label: 'Selezione' },
          { step: 2, label: 'Anamnesi' },
          { step: 3, label: 'Obiettivo' },
          { step: 4, label: 'Giudizio' }
        ].map((s, idx, arr) => (
          <div key={s.step} className={`flex items-center ${idx < arr.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-2 relative">
              <div className={`flex items-center justify-center w-12 h-12 rounded-2xl border-4 transition-all duration-500 ${
                step >= s.step ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white border-gray-100 text-gray-300'
              }`}>
                {step > s.step ? <CheckCircle size={22} strokeWidth={3} /> : <span className="font-black">{s.step}</span>}
              </div>
              <span className={`text-[10px] uppercase font-black tracking-widest absolute -bottom-6 whitespace-nowrap ${step >= s.step ? 'text-primary' : 'text-gray-300'}`}>
                {s.label}
              </span>
            </div>
            {idx < arr.length - 1 && (
              <div className={`flex-1 h-1 mx-4 rounded-full transition-colors duration-500 ${step > s.step ? 'bg-primary' : 'bg-gray-100'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="glass-card rounded-[40px] p-10 mt-8 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-primary/5 rounded-2xl"><User size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Scegli il Lavoratore</h2>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anagrafica Attiva (Ricerca Rapida)</label>
              <WorkerSearch onSelect={setSelectedWorkerId} />
            </div>

            {workerData && (
              <div className="bg-tealAction/5 p-6 rounded-3xl border border-tealAction/10 flex justify-between items-center group hover:bg-tealAction/10 transition-colors">
                <div>
                  <p className="text-tealAction font-black text-lg uppercase tracking-tight">{workerData.azienda}</p>
                  <p className="text-gray-500 font-bold text-sm">Mansione: <span className="text-primary font-black">{workerData.mansione}</span></p>
                </div>
                <div className="flex gap-4">
                  <select
                    className="bg-white border border-gray-100 rounded-xl px-4 font-black text-primary text-sm outline-none focus:ring-2 focus:ring-primary/10"
                    value={visitForm.tipo_visita}
                    onChange={e => setVisitForm({...visitForm, tipo_visita: e.target.value})}
                  >
                    <option value="preventiva">Visita Preventiva</option>
                    <option value="periodica">Visita Periodica</option>
                    <option value="richiesta">Su Richiesta</option>
                    <option value="cambio mansione">Cambio Mansione</option>
                    <option value="rientro">Dopo Assenza &gt;60gg</option>
                  </select>
                  <button onClick={() => setStep(2)} className="btn-teal flex items-center gap-3 px-8">Inizia <RefreshCw size={18} /></button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-primary">
                <div className="p-3 bg-primary/5 rounded-2xl"><Clipboard size={24} strokeWidth={2.5} /></div>
                <h2 className="text-2xl font-black tracking-tight">Anamnesi</h2>
              </div>
              <div className="bg-warmWhite/50 p-2 px-4 rounded-2xl border border-gray-100 font-black text-primary uppercase text-xs">
                {workerData?.cognome} {workerData?.nome}
              </div>
            </div>

            <div className="bg-accent/5 border border-accent/10 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-accent font-black flex items-center gap-2 text-sm uppercase tracking-tight">
                  <Mail size={18} /> Acquisizione Gmail
                </h3>
                <button onClick={handleAuthAndFetch} disabled={loadingGmail} className="btn-accent flex items-center gap-2 text-xs py-2 px-4">
                  {loadingGmail ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />} Sincronizza
                </button>
              </div>
              {gmailMessages.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {gmailMessages.map(msg => (
                    <div key={msg.id} className="bg-white/80 p-3 rounded-xl border border-accent/10 text-[10px] flex justify-between items-center gap-4">
                      <div className="flex-1 font-bold">[{msg.date}] {msg.snippet}</div>
                      <button onClick={() => importEmailText(msg)} className="text-accent hover:underline font-black uppercase tracking-tighter shrink-0">Importa</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anamnesi Lavorativa</label>
                <textarea className="input-standard h-40" value={visitForm.anamnesi_lavorativa} onChange={e => setVisitForm({...visitForm, anamnesi_lavorativa: e.target.value})} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anamnesi Patologica / Familiare</label>
                <textarea className="input-standard h-40" value={visitForm.anamnesi_patologica} onChange={e => setVisitForm({...visitForm, anamnesi_patologica: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(1)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Indietro</button>
              <button onClick={() => setStep(3)} className="btn-teal px-12 py-4">Prossimo Step</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-primary/5 rounded-2xl"><Activity size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Parametri e Esame Obiettivo</h2>
            </div>

            {/* Vital Signs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary/40"><Heart size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Sistolica</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitForm.p_sistolica} onChange={e => setVisitForm({...visitForm, p_sistolica: parseInt(e.target.value)})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">mmHg</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary/40"><Heart size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Diastolica</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitForm.p_diastolica} onChange={e => setVisitForm({...visitForm, p_diastolica: parseInt(e.target.value)})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">mmHg</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-tealAction/40"><Activity size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Frequenza</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-tealAction outline-none" value={visitForm.frequenza} onChange={e => setVisitForm({...visitForm, frequenza: parseInt(e.target.value)})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">bpm</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-accent/40"><Weight size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Peso</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-accent outline-none" value={visitForm.peso} onChange={e => setVisitForm({...visitForm, peso: parseFloat(e.target.value)})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">kg</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-accent/40"><Ruler size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Altezza</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-accent outline-none" value={visitForm.altezza} onChange={e => setVisitForm({...visitForm, altezza: parseInt(e.target.value)})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">cm</span>
              </div>
              <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 flex flex-col justify-center items-center gap-1">
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">BMI</span>
                <span className="text-2xl font-black text-primary">{calculateBMI()}</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary/40"><Wind size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">SpO2 %</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitForm.spo2} onChange={e => setVisitForm({...visitForm, spo2: parseInt(e.target.value)})} />
              </div>
            </div>

            {/* Structured EO Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                {[
                  { id: 'eo_cardiaca', label: 'Apparato Cardiovascolare', icon: <Heart size={16} /> },
                  { id: 'eo_respiratoria', label: 'Apparato Respiratorio', icon: <Wind size={16} /> },
                  { id: 'eo_cervicale', label: 'Rachide Cervicale', icon: <Stethoscope size={16} /> },
                  { id: 'eo_dorsolombare', label: 'Rachide Dorsolombare', icon: <Stethoscope size={16} /> },
                ].map(field => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      {field.icon} {field.label}
                    </label>
                    <textarea
                      className="input-standard h-20 text-sm"
                      placeholder="Note o 'Regolare'..."
                    value={(visitForm as any)[field.id as keyof Visit]}
                      onChange={e => setVisitForm({...visitForm, [field.id]: e.target.value})}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-6">
                {[
                  { id: 'eo_spalle', label: 'Spalle', icon: <Stethoscope size={16} /> },
                  { id: 'eo_arti_superiori', label: 'Arti Superiori (Gomiti, Polsi, Mani)', icon: <Stethoscope size={16} /> },
                  { id: 'eo_arti_inferiori', label: 'Arti Inferiori', icon: <Stethoscope size={16} /> },
                  { id: 'eo_altro', label: 'Altro / Accertamenti Strumentali', icon: <Activity size={16} /> },
                ].map(field => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      {field.icon} {field.label}
                    </label>
                    <textarea
                      className="input-standard h-20 text-sm"
                      placeholder="Note o 'Regolare'..."
                    value={(visitForm as any)[field.id as keyof Visit]}
                      onChange={e => setVisitForm({...visitForm, [field.id]: e.target.value})}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(2)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Indietro</button>
              <button onClick={() => setStep(4)} className="btn-teal px-12 py-4">Vai al Giudizio</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-accent/5 rounded-2xl text-accent"><CheckCircle size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Giudizio Finale</h2>
            </div>

            <div className="bg-accent/5 p-8 rounded-[40px] border border-accent/10 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Giudizio di Idoneità</label>
                <select className="input-standard font-black text-primary" value={visitForm.giudizio} onChange={e => setVisitForm({...visitForm, giudizio: e.target.value})}>
                  <option value="idoneo">IDONEO</option>
                  <option value="idoneo con prescrizioni">IDONEO CON PRESCRIZIONI</option>
                  <option value="idoneo con limitazioni">IDONEO CON LIMITAZIONI</option>
                  <option value="non idoneo temporaneo">NON IDONEO TEMPORANEO</option>
                  <option value="non idoneo permanente">NON IDONEO PERMANENTE</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prossima Visita</label>
                <input type="date" className="input-standard font-black text-primary" value={visitForm.scadenza_prossima} onChange={e => setVisitForm({...visitForm, scadenza_prossima: e.target.value})} />
              </div>
              <div className="col-span-full flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prescrizioni / Note</label>
                <textarea className="input-standard h-32" value={visitForm.prescrizioni} onChange={e => setVisitForm({...visitForm, prescrizioni: e.target.value})} />
              </div>
            </div>

            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(3)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Indietro</button>
              <div className="flex gap-4">
                 <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Visita+Medica:+${workerData?.cognome}+${workerData?.nome}&dates=${visitForm.scadenza_prossima.replace(/-/g, '')}T090000Z/${visitForm.scadenza_prossima.replace(/-/g, '')}T100000Z&details=Prossima+visita+programmata&sf=true&output=xml`}
                  target="_blank" rel="noopener noreferrer" className="btn-teal px-6 py-5"><RefreshCw size={22} /></a>
                 <button onClick={handleSave} className="btn-accent px-12 py-5 flex items-center gap-3 shadow-2xl shadow-accent/20"><Download size={22} strokeWidth={3} /> Salva Visita</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl border-2 border-white">
            <div className="p-8 bg-primary text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Printer size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Esporta PDF</h3>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Seleziona modalità di stampa</p>
                </div>
              </div>
              <button onClick={handleCloseVisit} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-10 space-y-4">
              <button
                onClick={() => handleExport('completa')}
                className="w-full flex items-center gap-6 p-6 rounded-3xl border-2 border-gray-100 hover:border-tealAction hover:bg-tealAction/5 transition-all group"
              >
                <div className="p-4 bg-gray-50 rounded-2xl group-hover:bg-tealAction/10 group-hover:text-tealAction transition-colors text-gray-400">
                  <FileText size={32} strokeWidth={1.5} />
                </div>
                <div className="text-left">
                  <p className="font-black text-primary text-lg leading-none">Cartella Sanitaria Completa</p>
                  <p className="text-gray-400 text-xs font-bold mt-1">Include Allegato 3A completo</p>
                </div>
              </button>

              <button
                onClick={() => handleExport('giudizio')}
                className="w-full flex items-center gap-6 p-6 rounded-3xl border-2 border-gray-100 hover:border-accent hover:bg-accent/5 transition-all group"
              >
                <div className="p-4 bg-gray-50 rounded-2xl group-hover:bg-accent/10 group-hover:text-accent transition-colors text-gray-400">
                  <Activity size={32} strokeWidth={1.5} />
                </div>
                <div className="text-left">
                  <p className="font-black text-primary text-lg leading-none">Giudizio di Idoneità</p>
                  <p className="text-gray-400 text-xs font-bold mt-1">Solo ultima sezione sintetica</p>
                </div>
              </button>

              <button
                onClick={() => handleExport('entrambi')}
                className="w-full flex items-center gap-6 p-6 rounded-3xl border-2 border-tealAction/20 bg-tealAction/5 hover:bg-tealAction/10 transition-all group"
              >
                <div className="p-4 bg-tealAction/10 rounded-2xl text-tealAction transition-colors">
                  <Printer size={32} strokeWidth={1.5} />
                </div>
                <div className="text-left">
                  <p className="font-black text-primary text-lg leading-none">Cartella + Giudizio</p>
                  <p className="text-gray-400 text-xs font-bold mt-1">Documento unico completo</p>
                </div>
              </button>

              <button
                onClick={handleCloseVisit}
                className="w-full py-4 text-gray-400 font-black uppercase text-xs tracking-widest hover:text-primary transition-colors pt-6"
              >
                Chiudi senza esportare
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NuovaVisita;
