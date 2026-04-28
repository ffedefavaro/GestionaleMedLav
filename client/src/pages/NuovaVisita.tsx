import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { User, Clipboard, Activity, CheckCircle, Download, Mail, RefreshCw, Copy, Shield } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { fetchGmailMessages, type GmailMessage } from '../lib/gmail';
import { fetchGmailAttachments } from '../lib/attachments';

const NuovaVisita = () => {
  const [lavoratori, setLavoratori] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerData, setWorkerData] = useState<any>(null);
  const [step, setStep] = useState(1);

  // Gmail State
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [visitForm, setVisitForm] = useState({
    data_visita: new Date().toISOString().split('T')[0],
    tipo_visita: 'preventiva',
    anamnesi_lavorativa: '',
    anamnesi_familiare: '',
    anamnesi_patologica: '',
    esame_obiettivo: '',
    giudizio: 'idoneo',
    prescrizioni: '',
    accertamenti_effettuati: '',
    scadenza_prossima: '',
    peso: 70,
    altezza: 170,
    p_sistolica: 120,
    p_diastolica: 80,
    frequenza: 70
  });

  useEffect(() => {
    const data = executeQuery(`
      SELECT workers.id, workers.nome, workers.cognome, workers.mansione, workers.email, workers.codice_fiscale, companies.ragione_sociale as azienda
      FROM workers
      JOIN companies ON workers.company_id = companies.id
    `);
    setLavoratori(data);
  }, []);

  useEffect(() => {
    if (selectedWorkerId) {
      const data = lavoratori.find(l => l.id.toString() === selectedWorkerId);
      setWorkerData(data);

      // Fetch full worker details with protocol info
      const fullWorker = executeQuery(`
        SELECT workers.*, protocols.periodicita_mesi as protocol_periodicity
        FROM workers
        LEFT JOIN protocols ON workers.protocol_id = protocols.id
        WHERE workers.id = ?
      `, [selectedWorkerId])[0];

      if (fullWorker) {
        let months = fullWorker.protocol_periodicity || 12;

        // If customized, find the minimum periodicity among exams
        if (fullWorker.is_protocol_customized && fullWorker.custom_protocol) {
          try {
            const customExams = JSON.parse(fullWorker.custom_protocol);
            if (customExams.length > 0) {
              months = Math.min(...customExams.map((e: any) => e.periodicita || 12));
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
  }, [selectedWorkerId, lavoratori]);

  const handleAuthAndFetch = async () => {
    const clientId = localStorage.getItem('google_client_id');
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
          if (response.access_token) {
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
        if (att.extracted_text) {
          textToImport += `\n--- ALLEGATO: ${att.filename} ---\n${att.extracted_text}\n`;
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
    // 1. Insert Visit
    await runCommand(`
      INSERT INTO visits (worker_id, data_visita, tipo_visita, anamnesi_lavorativa, anamnesi_familiare, anamnesi_patologica, esame_obiettivo, accertamenti_effettuati, giudizio, prescrizioni, scadenza_prossima, finalized)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      selectedWorkerId, visitForm.data_visita, visitForm.tipo_visita,
      visitForm.anamnesi_lavorativa, visitForm.anamnesi_familiare, visitForm.anamnesi_patologica,
      visitForm.esame_obiettivo, visitForm.accertamenti_effettuati, visitForm.giudizio, visitForm.prescrizioni, visitForm.scadenza_prossima
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
        INSERT INTO biometrics (visit_id, peso, altezza, bmi, pressione_sistolica, pressione_diastolica, frequenza_cardiaca)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [lastVisitData.id, visitForm.peso, visitForm.altezza, bmi, visitForm.p_sistolica, visitForm.p_diastolica, visitForm.frequenza]);
    }

    alert("Visita salvata con successo!");
    generatePDF();
    setStep(1);
    setSelectedWorkerId('');
  };

  const generatePDF = () => {
    const doctorData = executeQuery("SELECT * FROM doctor_profile WHERE id = 1")[0] || {};

    // 1. GIUDIZIO DI IDONEITÀ
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("GIUDIZIO DI IDONEITÀ ALLA MANSIONE SPECIFICA", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text("(D.Lgs. 81/08 e s.m.i. - Art. 41)", 105, 26, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.rect(15, 35, 180, 45);
    doc.text(`Lavoratore: ${workerData.cognome} ${workerData.nome}`, 20, 45);
    doc.text(`Codice Fiscale: ${workerData.codice_fiscale || 'N/D'}`, 20, 51);
    doc.text(`Azienda: ${workerData.azienda}`, 20, 57);
    doc.text(`Mansione: ${workerData.mansione}`, 20, 63);
    doc.text(`Data Visita: ${visitForm.data_visita}`, 20, 69);
    doc.text(`Tipo Visita: ${visitForm.tipo_visita.toUpperCase()}`, 20, 75);

    doc.setFont("helvetica", "bold");
    doc.text("GIUDIZIO:", 20, 90);
    doc.setFontSize(14);
    doc.text(visitForm.giudizio.toUpperCase(), 45, 90);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (visitForm.prescrizioni) {
      doc.text("Prescrizioni/Limitazioni:", 20, 100);
      doc.text(visitForm.prescrizioni, 20, 107, { maxWidth: 170 });
    }

    doc.text(`Prossima visita entro il: ${visitForm.scadenza_prossima}`, 20, 140);

    const signatureY = 170;
    doc.text(`Dott. ${doctorData.nome || '____________________'}`, 130, signatureY);
    doc.text(`Spec. ${doctorData.specializzazione || '____________________'}`, 130, signatureY + 6);
    doc.text(`N. Iscr. ${doctorData.n_iscrizione || '_______'}`, 130, signatureY + 12);
    doc.line(130, signatureY + 14, 190, signatureY + 14);
    doc.text("Firma del Medico Competente", 135, signatureY + 19);

    doc.save(`Giudizio_${workerData.cognome}_${visitForm.data_visita}.pdf`);

    // 2. CARTELLA SANITARIA E DI RISCHIO (ALLEGATO 3A)
    const cartella = new jsPDF();
    cartella.setFontSize(14);
    cartella.setFont("helvetica", "bold");
    cartella.text("CARTELLA SANITARIA E DI RISCHIO", 105, 20, { align: 'center' });
    cartella.setFontSize(10);
    cartella.text("(Allegato 3A - D.Lgs. 81/08)", 105, 26, { align: 'center' });

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 1: ANAGRAFICA", 15, 40);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Lavoratore: ${workerData.cognome} ${workerData.nome}`, 20, 47);
    cartella.text(`Data di nascita: ${workerData.data_nascita || 'N/D'}`, 20, 53);
    cartella.text(`Codice Fiscale: ${workerData.codice_fiscale || 'N/D'}`, 20, 59);
    cartella.text(`Azienda: ${workerData.azienda}`, 20, 65);
    cartella.text(`Mansione: ${workerData.mansione}`, 20, 71);

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 2: ANAMNESI", 15, 85);
    cartella.setFont("helvetica", "normal");
    cartella.text("Anamnesi Lavorativa:", 20, 92);
    cartella.text(visitForm.anamnesi_lavorativa || "Negativa", 25, 98, { maxWidth: 165 });
    cartella.text("Anamnesi Patologica e Familiare:", 20, 115);
    cartella.text(visitForm.anamnesi_patologica || "Negativa", 25, 121, { maxWidth: 165 });

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 3: ESAME OBIETTIVO E BIOMETRIA", 15, 150);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Peso: ${visitForm.peso}kg | Altezza: ${visitForm.altezza}cm | BMI: ${(visitForm.peso / ((visitForm.altezza/100)**2)).toFixed(1)}`, 20, 157);
    cartella.text(`Pressione: ${visitForm.p_sistolica}/${visitForm.p_diastolica} mmHg | FC: ${visitForm.frequenza} bpm`, 20, 163);
    cartella.text("Esame Obiettivo:", 20, 170);
    cartella.text(visitForm.esame_obiettivo || "Regolare", 25, 176, { maxWidth: 165 });

    cartella.setFont("helvetica", "bold");
    cartella.text("ACCERTAMENTI STRUMENTALI:", 20, 200);
    cartella.setFont("helvetica", "normal");
    cartella.text(visitForm.accertamenti_effettuati || "Non eseguiti", 25, 206, { maxWidth: 165 });

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 4: GIUDIZIO DI IDONEITA", 15, 220);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Giudizio: ${visitForm.giudizio.toUpperCase()}`, 20, 227);
    cartella.text(`Scadenza: ${visitForm.scadenza_prossima}`, 20, 233);

    cartella.save(`Cartella_3A_${workerData.cognome}_${visitForm.data_visita}.pdf`);
  };

  return (
    <div className="p-10 max-w-5xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black text-primary tracking-tight">Esecuzione Visita Medica</h1>
        <p className="text-gray-500 font-medium mt-1">Conformità D.Lgs 81/08 - Allegato 3A</p>
      </div>

      {/* Progress Stepper */}
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
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anagrafica Attiva</label>
              <select
                className="w-full bg-white/50 border border-gray-100 rounded-[20px] p-5 text-xl font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all appearance-none shadow-inner"
                value={selectedWorkerId}
                onChange={e => setSelectedWorkerId(e.target.value)}
              >
                <option value="">-- Seleziona dalla lista --</option>
                {lavoratori.map(l => (
                  <option key={l.id} value={l.id}>{l.cognome} {l.nome} | {l.azienda}</option>
                ))}
              </select>
            </div>

            {workerData && (
              <div className="bg-tealAction/5 p-6 rounded-3xl border border-tealAction/10 flex justify-between items-center group hover:bg-tealAction/10 transition-colors">
                <div>
                  <p className="text-tealAction font-black text-lg uppercase tracking-tight">{workerData.azienda}</p>
                  <p className="text-gray-500 font-bold text-sm">Mansione: <span className="text-primary font-black">{workerData.mansione}</span></p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="btn-teal flex items-center gap-3 px-8"
                >
                  Inizia Visita <RefreshCw size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-primary">
                <div className="p-3 bg-primary/5 rounded-2xl"><Clipboard size={24} strokeWidth={2.5} /></div>
                <h2 className="text-2xl font-black tracking-tight">Anamnesi e Biometria</h2>
              </div>

              <div className="flex items-center gap-4 bg-warmWhite/50 p-2 rounded-2xl border border-gray-100">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paziente Selezionato</span>
                  <span className="text-sm font-black text-primary">{workerData.cognome} {workerData.nome}</span>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-black">
                  {workerData.cognome[0]}{workerData.nome[0]}
                </div>
              </div>
            </div>

            {/* Gmail Import Section - Redesigned */}
            <div className="bg-accent/5 border border-accent/10 rounded-3xl p-6 relative overflow-hidden">
              <div className="flex justify-between items-center mb-4 relative z-10">
                <div>
                  <h3 className="text-accent font-black flex items-center gap-2 text-sm uppercase tracking-tight">
                    <Mail size={18} /> Acquisizione Documenti Gmail
                  </h3>
                  <p className="text-xs font-medium text-gray-500 mt-1">Sincronizzazione messaggi da {workerData.email}</p>
                </div>
                <button
                  onClick={handleAuthAndFetch}
                  disabled={loadingGmail || !workerData.email}
                  className="btn-accent flex items-center gap-2 text-xs py-2 px-4 shadow-accent/10"
                >
                  {loadingGmail ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  Sincronizza Mail
                </button>
              </div>

              {gmailMessages.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 relative z-10 custom-scrollbar">
                  {gmailMessages.map(msg => (
                    <div key={msg.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-accent/10 text-xs flex justify-between items-center gap-4 hover:bg-white transition-colors">
                      <div className="flex-1">
                        <div className="font-black text-primary mb-1">{msg.date}</div>
                        <div className="text-gray-500 font-medium italic line-clamp-1">"{msg.snippet}"</div>
                      </div>
                      <button
                        onClick={() => importEmailText(msg)}
                        className="text-accent hover:bg-accent hover:text-white p-2.5 rounded-xl border border-accent/20 transition-all font-black flex items-center gap-2 uppercase tracking-tighter"
                      >
                        <Copy size={14} /> Importa
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-white/30 rounded-2xl border border-dashed border-accent/20">
                   <p className="text-xs text-accent/60 font-bold italic uppercase tracking-widest">Nessuna comunicazione recente trovata</p>
                </div>
              )}
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Mail size={120} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anamnesi Lavorativa</label>
                  <textarea
                    className="input-standard h-32"
                    placeholder="Riepilogo esposizioni pregresse..."
                    value={visitForm.anamnesi_lavorativa}
                    onChange={e => setVisitForm({...visitForm, anamnesi_lavorativa: e.target.value})}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anamnesi Familiare e Patologica</label>
                  <textarea
                    className="input-standard h-32"
                    placeholder="Patologie pregresse, familiarità..."
                    value={visitForm.anamnesi_patologica}
                    onChange={e => setVisitForm({...visitForm, anamnesi_patologica: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-primary/5 p-8 rounded-[32px] border border-primary/5 space-y-6">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-6 bg-primary rounded-full" />
                   <p className="font-black text-sm text-primary uppercase tracking-widest">Parametri Biometrici</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Peso (kg)</label>
                    <input type="number" className="input-standard font-black text-lg" value={visitForm.peso} onChange={e => setVisitForm({...visitForm, peso: parseFloat(e.target.value)})} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Altezza (cm)</label>
                    <input type="number" className="input-standard font-black text-lg" value={visitForm.altezza} onChange={e => setVisitForm({...visitForm, altezza: parseInt(e.target.value)})} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PA Sistolica</label>
                    <input type="number" className="input-standard font-black text-lg text-tealAction" value={visitForm.p_sistolica} onChange={e => setVisitForm({...visitForm, p_sistolica: parseInt(e.target.value)})} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PA Diastolica</label>
                    <input type="number" className="input-standard font-black text-lg text-tealAction" value={visitForm.p_diastolica} onChange={e => setVisitForm({...visitForm, p_diastolica: parseInt(e.target.value)})} />
                  </div>
                </div>
                <div className="pt-4 border-t border-primary/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">BMI CALCOLATO</span>
                    <span className="text-2xl font-black text-primary">{(visitForm.peso / ((visitForm.altezza/100)**2)).toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(1)} className="px-6 py-3 text-gray-400 font-bold hover:text-primary transition uppercase text-[10px] tracking-widest">Annulla / Indietro</button>
              <button onClick={() => setStep(3)} className="btn-teal px-12 py-4">Continua Visita</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-primary/5 rounded-2xl"><Activity size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Esame Obiettivo e Accertamenti</h2>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Accertamenti Strumentali Effettuati</label>
                <textarea
                  placeholder="es. Audiometria (normale), Spirometria (FVC 95%), ECG (ritmo sinusale)..."
                  className="input-standard h-32 border-tealAction/20 focus:border-tealAction focus:ring-tealAction/5"
                  value={visitForm.accertamenti_effettuati}
                  onChange={e => setVisitForm({...visitForm, accertamenti_effettuati: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Risultanze Esame Obiettivo</label>
                <textarea
                  placeholder="es. Torace normoconformato, MV presente su tutto l'ambito, toni cardiaci puri..."
                  className="input-standard h-48"
                  value={visitForm.esame_obiettivo}
                  onChange={e => setVisitForm({...visitForm, esame_obiettivo: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(2)} className="px-6 py-3 text-gray-400 font-bold hover:text-primary transition uppercase text-[10px] tracking-widest">Indietro</button>
              <button onClick={() => setStep(4)} className="btn-teal px-12 py-4">Vai al Giudizio</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-accent/5 rounded-2xl text-accent"><CheckCircle size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Giudizio Finale di Idoneità</h2>
            </div>

            <div className="bg-accent/5 p-8 rounded-[40px] border border-accent/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Giudizio di Idoneità</label>
                  <select
                    className="input-standard font-black text-primary text-lg"
                    value={visitForm.giudizio}
                    onChange={e => setVisitForm({...visitForm, giudizio: e.target.value})}
                  >
                    <option value="idoneo">IDONEO</option>
                    <option value="idoneo con prescrizioni">IDONEO CON PRESCRIZIONI</option>
                    <option value="idoneo con limitazioni">IDONEO CON LIMITAZIONI</option>
                    <option value="non idoneo temporaneo">NON IDONEO TEMPORANEO</option>
                    <option value="non idoneo permanente">NON IDONEO PERMANENTE</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Scadenza Sorveglianza</label>
                  <input
                    type="date"
                    className="input-standard font-black text-primary"
                    value={visitForm.scadenza_prossima}
                    onChange={e => setVisitForm({...visitForm, scadenza_prossima: e.target.value})}
                  />
                </div>
                <div className="col-span-full flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prescrizioni e Note Legali</label>
                  <textarea
                    className="input-standard h-32 bg-white/80"
                    placeholder="Dettagliare prescrizioni specifiche o limitazioni d'uso..."
                    value={visitForm.prescrizioni}
                    onChange={e => setVisitForm({...visitForm, prescrizioni: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-6 rounded-3xl flex items-center gap-4 text-primary text-xs font-black uppercase tracking-tighter">
              <Shield size={20} className="shrink-0" />
              <p>Il salvataggio finalizzerà la visita e genererà i documenti PDF (Giudizio e Cartella 3A) pronti per la firma.</p>
            </div>

            <div className="flex justify-between items-center mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(3)} className="px-6 py-3 text-gray-400 font-bold hover:text-primary transition uppercase text-[10px] tracking-widest">Indietro</button>
              <div className="flex gap-4">
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Visita+Medica:+${workerData.cognome}+${workerData.nome}&dates=${visitForm.scadenza_prossima.replace(/-/g, '')}T090000Z/${visitForm.scadenza_prossima.replace(/-/g, '')}T100000Z&details=Visita+periodica+programmata+per+${workerData.cognome}+${workerData.nome}+(${workerData.azienda})&sf=true&output=xml`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-teal px-6 py-5 flex items-center gap-3"
                  title="Pianifica prossima visita su Google Calendar"
                >
                  <RefreshCw size={22} />
                </a>
                <button
                  onClick={handleSave}
                  className="btn-accent px-12 py-5 flex items-center gap-3 shadow-2xl"
                >
                  <Download size={22} strokeWidth={3} /> Finalizza e Stampa PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NuovaVisita;
