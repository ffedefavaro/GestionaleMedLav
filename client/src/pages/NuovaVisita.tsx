import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import {
  User, Clipboard, Activity, CheckCircle, Download, Mail, RefreshCw,
  Heart, Weight, Ruler, Wind, Stethoscope, Plus, Trash2, Calendar,
  AlertCircle, Info, Cigarette, Beer, Dumbbell, Pill, Users
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { fetchGmailMessages } from '../lib/gmail';
import { fetchGmailAttachments } from '../lib/attachments';
import { get } from 'idb-keyval';
import WorkerSearch from '../components/WorkerSearch';

interface Worker {
  id: number;
  company_id: number;
  nome: string;
  cognome: string;
  codice_fiscale: string;
  email?: string;
  data_nascita?: string;
  data_assunzione?: string;
  protocol_id?: number;
  is_protocol_customized: number;
  custom_protocol?: string;
  protocol_override_reason?: string;
  azienda?: string;
  permanent_anamnesis?: string;
}

interface RiskMaster {
  nome: string;
}

interface WorkHistoryItem {
  azienda?: string;
  mansione?: string;
  periodo?: string;
  [key: string]: any;
}

interface AnamnesisState {
  storia_lavorativa: WorkHistoryItem[];
  patologica_lavorativa: {
    infortuni: { status: string; numero: number; tipo: string; anno_ultimo: string };
    malattie_prof: { status: string; quale: string; anno: string };
    limitazioni_prev: { status: string; testo: string };
  };
  patologica_generale: {
    cardiovascolare: { status: string; note: string };
    respiratorio: { status: string; note: string };
    muscoloscheletrico: { status: string; note: string };
    neurologico: { status: string; note: string };
    psichiatrico: { status: string; note: string };
    metabolico: { status: string; note: string };
    altro: { status: string; note: string };
  };
  abitudini: {
    fumo: { status: string; n_sigarette: number };
    alcol: string;
    attivita_fisica: string;
    farmaci: string;
  };
  familiare: {
    patologie: string[];
    note: string;
  };
}

const NuovaVisita = () => {
  const [lavoratori, setLavoratori] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [hasGoogleId, setHasGoogleId] = useState(false);
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  const [step, setStep] = useState(1);
  const [risksMaster, setRisksMaster] = useState<RiskMaster[]>([]);

  // Gmail State
  const [loadingGmail, setLoadingGmail] = useState(false);

  const [visitForm, setVisitForm] = useState({
    data_visita: new Date().toISOString().split('T')[0],
    tipo_visita: 'periodica',
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

  const [anamnesis, setAnamnesis] = useState<AnamnesisState>({
    storia_lavorativa: [],
    patologica_lavorativa: {
      infortuni: { status: 'no', numero: 0, tipo: '', anno_ultimo: '' },
      malattie_prof: { status: 'no', quale: '', anno: '' },
      limitazioni_prev: { status: 'no', testo: '' }
    },
    patologica_generale: {
      cardiovascolare: { status: 'no', note: '' },
      respiratorio: { status: 'no', note: '' },
      muscoloscheletrico: { status: 'no', note: '' },
      neurologico: { status: 'no', note: '' },
      psichiatrico: { status: 'no', note: '' },
      metabolico: { status: 'no', note: '' },
      altro: { status: 'no', note: '' }
    },
    abitudini: {
      fumo: { status: 'non fumatore', n_sigarette: 0 },
      alcol: 'no',
      attivita_fisica: 'sedentario',
      farmaci: ''
    },
    familiare: {
      patologie: [],
      note: ''
    }
  });

  useEffect(() => {
    const data = executeQuery(`
      SELECT workers.*, companies.ragione_sociale as azienda
      FROM workers
      JOIN companies ON workers.company_id = companies.id
    `);
    setLavoratori(data);
    const risks = executeQuery("SELECT nome FROM risks_master ORDER BY nome");
    setRisksMaster(risks);
    get('google_client_id').then(id => setHasGoogleId(!!id));
  }, []);

  useEffect(() => {
    if (selectedWorkerId) {
      const worker = lavoratori.find(l => l.id.toString() === selectedWorkerId);
      if (worker) {
        // Load permanent anamnesis if exists
        if (worker.permanent_anamnesis) {
          try {
            setAnamnesis(JSON.parse(worker.permanent_anamnesis));
          } catch (e) {
            console.error("Error parsing anamnesis", e);
          }
        } else {
          // Reset if new worker
          setAnamnesis({
            storia_lavorativa: [],
            patologica_lavorativa: {
              infortuni: { status: 'no', numero: 0, tipo: '', anno_ultimo: '' },
              malattie_prof: { status: 'no', quale: '', anno: '' },
              limitazioni_prev: { status: 'no', testo: '' }
            },
            patologica_generale: {
              cardiovascolare: { status: 'no', note: '' },
              respiratorio: { status: 'no', note: '' },
              muscoloscheletrico: { status: 'no', note: '' },
              neurologico: { status: 'no', note: '' },
              psichiatrico: { status: 'no', note: '' },
              metabolico: { status: 'no', note: '' },
              altro: { status: 'no', note: '' }
            },
            abitudini: {
              fumo: { status: 'non fumatore', n_sigarette: 0 },
              alcol: 'no',
              attivita_fisica: 'sedentario',
              farmaci: ''
            },
            familiare: {
              patologie: [],
              note: ''
            }
          });
        }

        const fullWorker = executeQuery(`
          SELECT protocols.periodicita_mesi as protocol_periodicity
          FROM workers
          LEFT JOIN protocols ON workers.protocol_id = protocols.id
          WHERE workers.id = ?
        `, [selectedWorkerId])[0];

        if (fullWorker) {
          let months = fullWorker.protocol_periodicity || 12;
          const nextDate = new Date();
          nextDate.setMonth(nextDate.getMonth() + months);
          setVisitForm(prev => ({...prev, scadenza_prossima: nextDate.toISOString().split('T')[0]}));
        }
      }
    } else {
      setWorkerData(null);
    }
  }, [selectedWorkerId, lavoratori]);

  const handleSave = async () => {
    // 1. Insert Visit with structured exam and anamnesis fields
    await runCommand(`
      INSERT INTO visits (
        worker_id, data_visita, tipo_visita, structured_anamnesis,
        accertamenti_effettuati, eo_cardiaca, eo_respiratoria, eo_cervicale, eo_dorsolombare,
        eo_spalle, eo_arti_superiori, eo_arti_inferiori, eo_altro, giudizio, prescrizioni, scadenza_prossima, finalized
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      selectedWorkerId, visitForm.data_visita, visitForm.tipo_visita,
      JSON.stringify(anamnesis),
      visitForm.accertamenti_effettuati, visitForm.eo_cardiaca, visitForm.eo_respiratoria,
      visitForm.eo_cervicale, visitForm.eo_dorsolombare, visitForm.eo_spalle,
      visitForm.eo_arti_superiori, visitForm.eo_arti_inferiori, visitForm.eo_altro,
      visitForm.giudizio, visitForm.prescrizioni, visitForm.scadenza_prossima
    ]);

    // 2. Update Worker Permanent Anamnesis
    await runCommand(`
      UPDATE workers SET permanent_anamnesis = ? WHERE id = ?
    `, [JSON.stringify(anamnesis), selectedWorkerId]);

    const lastVisitData = executeQuery("SELECT id FROM visits ORDER BY id DESC LIMIT 1")[0];

    // Log action for legal audit
    await runCommand(
      "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
      ["FINALIZE", "visits", lastVisitData.id, `Visita strutturata finalizzata per lavoratore ID: ${selectedWorkerId}`]
    );

    // 3. Insert Biometrics
    if (lastVisitData) {
      const bmi = visitForm.peso / ((visitForm.altezza/100) ** 2);
      await runCommand(`
        INSERT INTO biometrics (visit_id, peso, altezza, bmi, pressione_sistolica, pressione_diastolica, frequenza_cardiaca, spo2)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [lastVisitData.id, visitForm.peso, visitForm.altezza, bmi, visitForm.p_sistolica, visitForm.p_diastolica, visitForm.frequenza, visitForm.spo2]);
    }

    alert("Visita salvata con successo!");
    generatePDF();
    setStep(1);
    setSelectedWorkerId('');
  };

  const addExperience = () => {
    setAnamnesis({
      ...anamnesis,
      storia_lavorativa: [
        ...anamnesis.storia_lavorativa,
        { azienda: '', mansione: '', da: '', a: '', rischi: [], note: '' }
      ]
    });
  };

  const removeExperience = (index: number) => {
    const newList = [...anamnesis.storia_lavorativa];
    newList.splice(index, 1);
    setAnamnesis({ ...anamnesis, storia_lavorativa: newList });
  };

  const updateExperience = (index: number, field: string, value: unknown) => {
    const newList = [...anamnesis.storia_lavorativa];
    newList[index] = { ...newList[index], [field]: value };
    setAnamnesis({ ...anamnesis, storia_lavorativa: newList });
  };

  const calculateExposure = () => {
    const summary: Record<string, number> = {};
    anamnesis.storia_lavorativa.forEach(exp => {
      const start = parseInt(exp.da);
      const end = exp.a ? parseInt(exp.a) : new Date().getFullYear();
      if (!isNaN(start) && !isNaN(end)) {
        const years = end - start;
        exp.rischi.forEach((r: string) => {
          summary[r] = (summary[r] || 0) + years;
        });
      }
    });
    return summary;
  };

  const generatePDF = () => {
    const doctorData = executeQuery("SELECT * FROM doctor_profile WHERE id = 1")[0] || {};
    const doc = new jsPDF();

    // GIUDIZIO DI IDONEITÀ (Standard)
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

    // CARTELLA SANITARIA E DI RISCHIO (STRUTTURATA)
    const cartella = new jsPDF();
    cartella.setFontSize(14);
    cartella.setFont("helvetica", "bold");
    cartella.text("CARTELLA SANITARIA E DI RISCHIO", 105, 20, { align: 'center' });
    cartella.setFontSize(10);
    cartella.text("(Allegato 3A - D.Lgs. 81/08)", 105, 26, { align: 'center' });

    cartella.text("SEZIONE 1: ANAGRAFICA", 15, 40);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Lavoratore: ${workerData.cognome} ${workerData.nome} | CF: ${workerData.codice_fiscale}`, 20, 47);
    cartella.text(`Azienda: ${workerData.azienda} | Mansione: ${workerData.mansione}`, 20, 53);

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 2: ANAMNESI LAVORATIVA E STORIA", 15, 65);
    cartella.setFont("helvetica", "normal");
    let currentY = 72;
    anamnesis.storia_lavorativa.forEach((exp, i) => {
      cartella.text(`${i+1}. ${exp.azienda} - ${exp.mansione} (${exp.da}-${exp.a || 'oggi'})`, 20, currentY);
      cartella.setFontSize(8);
      cartella.text(`   Rischi: ${exp.rischi.join(', ')}`, 20, currentY + 4);
      cartella.setFontSize(10);
      currentY += 10;
    });

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 3: ANAMNESI PATOLOGICA E ABITUDINI", 15, currentY + 5);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Fumo: ${anamnesis.abitudini.fumo.status} (${anamnesis.abitudini.fumo.n_sigarette}/die) | Alcol: ${anamnesis.abitudini.alcol}`, 20, currentY + 12);
    cartella.text(`Infortuni: ${anamnesis.patologica_lavorativa.infortuni.status} | Malattie Prof: ${anamnesis.patologica_lavorativa.malattie_prof.status}`, 20, currentY + 18);

    currentY += 25;
    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 4: PARAMETRI E ESAME OBIETTIVO", 15, currentY);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Peso: ${visitForm.peso}kg | Altezza: ${visitForm.altezza}cm | BMI: ${(visitForm.peso / ((visitForm.altezza/100)**2)).toFixed(1)}`, 20, currentY + 7);
    cartella.text(`PA: ${visitForm.p_sistolica}/${visitForm.p_diastolica} mmHg | FC: ${visitForm.frequenza} bpm | SpO2: ${visitForm.spo2}%`, 20, currentY + 13);

    currentY += 20;
    const addEO = (label: string, text: string) => {
      if (text && currentY < 270) {
        cartella.setFont("helvetica", "bold");
        cartella.text(`${label}:`, 20, currentY);
        cartella.setFont("helvetica", "normal");
        cartella.text(text, 25, currentY + 5, { maxWidth: 165 });
        currentY += 12;
      }
    };

    addEO("Cardio", visitForm.eo_cardiaca);
    addEO("Resp", visitForm.eo_respiratoria);
    addEO("Rachide", `${visitForm.eo_cervicale} ${visitForm.eo_dorsolombare}`);
    addEO("Arti", `${visitForm.eo_spalle} ${visitForm.eo_arti_superiori} ${visitForm.eo_arti_inferiori}`);

    cartella.save(`Cartella_3A_${workerData.cognome}_${visitForm.data_visita}.pdf`);
  };

  const handleAuthAndImport = async () => {
    const clientId = await get('google_client_id');
    if (!clientId) {
      alert("Configura il Google Client ID nelle impostazioni prima di usare Gmail.");
      return;
    }

    if (!workerData?.email) {
      alert("Il lavoratore non ha un indirizzo email configurato. Impossibile filtrare i messaggi.");
      return;
    }

    setLoadingGmail(true);

    // Timeout of 10 seconds
    const timeoutId = setTimeout(() => {
      if (loadingGmail) {
        setLoadingGmail(false);
        alert("La sincronizzazione Gmail ha impiegato troppo tempo. Verifica la connessione o le credenziali OAuth.");
      }
    }, 10000);

    try {
      const win = window as typeof window & { google?: { accounts?: { oauth2?: { initTokenClient?: (config: { client_id: string; scope: string; callback: (response: { error?: string; error_description?: string; access_token?: string }) => void }) => unknown } } } };
      
      if (!win.google?.accounts?.oauth2) {
        throw new Error("Google API non caricata correttamente.");
      }

      const client = win.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: async (response: { error?: string; error_description?: string; access_token?: string }) => {
          clearTimeout(timeoutId);
          if (response.error) {
            console.error("OAuth Error:", response.error);
            setLoadingGmail(false);
            alert(`Errore OAuth: ${response.error_description || response.error}`);
            return;
          }

          if (response.access_token) {
            try {
              console.log(`Ricerca mail per: ${workerData.email}`);
              const msgs = await fetchGmailMessages(response.access_token, workerData.email);

              if (msgs.length > 0) {
                const latest = msgs[0];
                let textToImport = `--- EMAIL del ${latest.date} ---\n${latest.body}\n`;

                try {
                  const attachments = await fetchGmailAttachments(response.access_token, latest.id);
                  attachments.forEach(att => {
                    if (att.extractedText) textToImport += `\n--- ALLEGATO: ${att.filename} ---\n${att.extractedText}\n`;
                  });
                } catch (attErr) {
                  console.warn("Errore durante il recupero allegati:", attErr);
                }

                setAnamnesis(prev => ({
                  ...prev,
                  patologica_generale: {
                    ...prev.patologica_generale,
                    altro: { status: 'si', note: (prev.patologica_generale.altro.note || "") + "\n" + textToImport }
                  }
                }));
                alert("Dati importati con successo dall'ultima email!");
              } else {
                alert(`Nessuna comunicazione trovata da: ${workerData.email}`);
              }
            } catch (fetchErr: unknown) {
              const err = fetchErr as Error;
              console.error("Gmail Fetch Error:", err);
              alert(`Errore durante il recupero delle mail: ${err.message}`);
            }
          }
          setLoadingGmail(false);
        },
      });
      client.requestAccessToken();
    } catch (e: unknown) {
      const err = e as Error;
      clearTimeout(timeoutId);
      console.error("Gmail Integration Error:", err);
      setLoadingGmail(false);
      alert(`Errore Integrazione Gmail: ${err.message}`);
    }
  };

  const exposures = calculateExposure();

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black text-primary tracking-tight">Esecuzione Visita Medica</h1>
        <p className="text-gray-500 font-medium mt-1">Protocollo Strutturato D.Lgs 81/08</p>
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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-primary/5 rounded-2xl"><User size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Scegli il Lavoratore</h2>
            </div>
            <WorkerSearch onSelect={setSelectedWorkerId} />
            {workerData && (
              <div className="bg-tealAction/5 p-8 rounded-3xl border border-tealAction/10 flex justify-between items-center group animate-in slide-in-from-top-4">
                <div>
                  <p className="text-tealAction font-black text-xl uppercase tracking-tight">{workerData.azienda}</p>
                  <p className="text-gray-500 font-bold">Mansione: <span className="text-primary font-black">{workerData.mansione}</span></p>
                </div>
                <button onClick={() => setStep(2)} className="btn-teal flex items-center gap-3 px-8">Inizia Visita <RefreshCw size={18} /></button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-4 text-primary">
                 <div className="p-3 bg-primary/5 rounded-2xl"><Clipboard size={24} strokeWidth={2.5} /></div>
                 <h2 className="text-2xl font-black tracking-tight uppercase">Anamnesi Strutturata</h2>
               </div>
               <div className="bg-warmWhite/50 p-3 px-6 rounded-2xl border border-gray-100 font-black text-primary uppercase text-sm tracking-tight">
                 {workerData.cognome} {workerData.nome}
               </div>
            </div>

            {/* 1. STORIA LAVORATIVA */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={18} className="text-tealAction" /> 1. Storia Lavorativa (Timeline)
                </h3>
                <button onClick={addExperience} className="btn-teal !py-2 !px-4 text-[10px] flex items-center gap-2">
                  <Plus size={14} strokeWidth={3} /> Aggiungi Esperienza
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {anamnesis.storia_lavorativa.map((exp, idx) => (
                  <div key={idx} className="bg-white border border-gray-100 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative group">
                    <button onClick={() => removeExperience(idx)} className="absolute top-4 right-4 text-gray-300 hover:text-accent transition-colors">
                      <Trash2 size={16} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Azienda</label>
                        <input className="input-standard !py-2 text-sm" value={exp.azienda} onChange={e => updateExperience(idx, 'azienda', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mansione</label>
                        <input className="input-standard !py-2 text-sm" value={exp.mansione} onChange={e => updateExperience(idx, 'mansione', e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Da (Anno)</label>
                          <input type="number" className="input-standard !py-2 text-sm" value={exp.da} onChange={e => updateExperience(idx, 'da', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">A (Anno)</label>
                          <input type="number" className="input-standard !py-2 text-sm" placeholder="Oggi" value={exp.a} onChange={e => updateExperience(idx, 'a', e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rischi Esposti</label>
                        <select
                          multiple
                          className="w-full bg-warmWhite border border-gray-100 rounded-xl p-2 text-[10px] font-bold text-primary h-20 outline-none"
                          value={exp.rischi}
                          onChange={e => {
                            const values = Array.from(e.target.selectedOptions, option => option.value);
                            updateExperience(idx, 'rischi', values);
                          }}
                        >
                          {risksMaster.map(r => <option key={r.nome} value={r.nome}>{r.nome}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 2. ESPOSIZIONI CUMULATIVE */}
              {Object.keys(exposures).length > 0 && (
                <div className="bg-tealAction/5 p-6 rounded-3xl border border-tealAction/10 flex flex-wrap gap-4 items-center">
                  <span className="text-[9px] font-black text-tealAction uppercase tracking-widest mr-4">Esposizioni Cumulative:</span>
                  {Object.entries(exposures).map(([risk, years]) => (
                    <div key={risk} className="bg-white px-3 py-1.5 rounded-xl border border-tealAction/20 text-xs font-black text-primary">
                      {risk}: <span className="text-tealAction">{years} anni</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. PATOLOGICA LAVORATIVA */}
            <div className="space-y-6 pt-10 border-t border-gray-100">
               <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle size={18} className="text-accent" /> 3. Anamnesi Patologica Lavorativa
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-warmWhite/30 p-6 rounded-3xl space-y-4">
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest">Infortuni sul Lavoro</p>
                     <div className="flex gap-4">
                        <button
                          onClick={() => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, infortuni: {...anamnesis.patologica_lavorativa.infortuni, status: 'si'}}})}
                          className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${anamnesis.patologica_lavorativa.infortuni.status === 'si' ? 'bg-accent text-white' : 'bg-white text-gray-300 border border-gray-100'}`}
                        >SÌ</button>
                        <button
                          onClick={() => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, infortuni: {...anamnesis.patologica_lavorativa.infortuni, status: 'no'}}})}
                          className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${anamnesis.patologica_lavorativa.infortuni.status === 'no' ? 'bg-tealAction text-white' : 'bg-white text-gray-300 border border-gray-100'}`}
                        >NO</button>
                     </div>
                     {anamnesis.patologica_lavorativa.infortuni.status === 'si' && (
                       <div className="animate-in fade-in slide-in-from-top-2 space-y-2">
                          <input placeholder="N° infortuni" type="number" className="input-standard !py-2 text-xs" value={anamnesis.patologica_lavorativa.infortuni.numero} onChange={e => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, infortuni: {...anamnesis.patologica_lavorativa.infortuni, numero: parseInt(e.target.value)}}})} />
                          <input placeholder="Anno ultimo" className="input-standard !py-2 text-xs" value={anamnesis.patologica_lavorativa.infortuni.anno_ultimo} onChange={e => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, infortuni: {...anamnesis.patologica_lavorativa.infortuni, anno_ultimo: e.target.value}}})} />
                       </div>
                     )}
                  </div>
                  <div className="bg-warmWhite/30 p-6 rounded-3xl space-y-4">
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest">Malattie Professionali</p>
                     <div className="flex gap-4">
                        <button
                          onClick={() => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, malattie_prof: {...anamnesis.patologica_lavorativa.malattie_prof, status: 'si'}}})}
                          className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${anamnesis.patologica_lavorativa.malattie_prof.status === 'si' ? 'bg-accent text-white' : 'bg-white text-gray-300 border border-gray-100'}`}
                        >SÌ</button>
                        <button
                          onClick={() => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, malattie_prof: {...anamnesis.patologica_lavorativa.malattie_prof, status: 'no'}}})}
                          className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${anamnesis.patologica_lavorativa.malattie_prof.status === 'no' ? 'bg-tealAction text-white' : 'bg-white text-gray-300 border border-gray-100'}`}
                        >NO</button>
                     </div>
                     {anamnesis.patologica_lavorativa.malattie_prof.status === 'si' && (
                        <div className="animate-in fade-in slide-in-from-top-2 space-y-2">
                           <input placeholder="Quale malattia?" className="input-standard !py-2 text-xs" value={anamnesis.patologica_lavorativa.malattie_prof.quale} onChange={e => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, malattie_prof: {...anamnesis.patologica_lavorativa.malattie_prof, quale: e.target.value}}})} />
                        </div>
                     )}
                  </div>
                  <div className="bg-warmWhite/30 p-6 rounded-3xl space-y-4">
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest">Limitazioni Precedenti</p>
                     <div className="flex gap-4">
                        <button
                          onClick={() => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, limitazioni_prev: {...anamnesis.patologica_lavorativa.limitazioni_prev, status: 'si'}}})}
                          className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${anamnesis.patologica_lavorativa.limitazioni_prev.status === 'si' ? 'bg-accent text-white' : 'bg-white text-gray-300 border border-gray-100'}`}
                        >SÌ</button>
                        <button
                          onClick={() => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, limitazioni_prev: {...anamnesis.patologica_lavorativa.limitazioni_prev, status: 'no'}}})}
                          className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${anamnesis.patologica_lavorativa.limitazioni_prev.status === 'no' ? 'bg-tealAction text-white' : 'bg-white text-gray-300 border border-gray-100'}`}
                        >NO</button>
                     </div>
                     {anamnesis.patologica_lavorativa.limitazioni_prev.status === 'si' && (
                        <textarea placeholder="Descrizione limitazione..." className="input-standard !py-2 text-xs h-20" value={anamnesis.patologica_lavorativa.limitazioni_prev.testo} onChange={e => setAnamnesis({...anamnesis, patologica_lavorativa: {...anamnesis.patologica_lavorativa, limitazioni_prev: {...anamnesis.patologica_lavorativa.limitazioni_prev, testo: e.target.value}}})} />
                     )}
                  </div>
               </div>
            </div>

            {/* 4. PATOLOGICA GENERALE */}
            <div className="space-y-6 pt-10 border-t border-gray-100">
               <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Stethoscope size={18} className="text-primary" /> 4. Anamnesi Patologica Generale
                  </h3>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={handleAuthAndImport}
                    disabled={loadingGmail}
                    className="btn-accent !py-2 !px-4 text-[10px] flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingGmail ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                    {loadingGmail ? 'Sincronizzazione...' : 'Importa Ultima Mail'}
                  </button>
                  {!hasGoogleId && (
                    <span className="text-[8px] font-black text-accent uppercase tracking-tighter bg-accent/5 px-2 py-1 rounded border border-accent/10 animate-pulse">
                      Configura Google ID nelle Impostazioni
                    </span>
                  )}
                  {hasGoogleId && !workerData?.email && (
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter bg-gray-50 px-2 py-1 rounded border border-gray-100">
                      Email lavoratore mancante
                    </span>
                  )}
                </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Object.entries(anamnesis.patologica_generale).map(([key, value]) => (
                    <div key={key} className="bg-white border border-gray-100 p-5 rounded-3xl space-y-3">
                       <p className="text-[10px] font-black text-primary uppercase tracking-widest">{key}</p>
                       <select
                        className={`w-full p-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${value.status === 'si' ? 'border-accent text-accent bg-accent/5' : 'border-gray-50 text-gray-300'}`}
                        value={value.status}
                        onChange={e => setAnamnesis({...anamnesis, patologica_generale: {...anamnesis.patologica_generale, [key]: {...value, status: e.target.value}}})}
                       >
                          <option value="no">Assente</option>
                          <option value="si">Presente</option>
                          <option value="non noto">Non Noto</option>
                       </select>
                       {value.status === 'si' && (
                         <textarea
                          placeholder="Note patologia..."
                          className="input-standard !py-2 text-[10px] h-16"
                          value={value.note}
                          onChange={e => setAnamnesis({...anamnesis, patologica_generale: {...anamnesis.patologica_generale, [key]: {...value, note: e.target.value}}})}
                         />
                       )}
                    </div>
                  ))}
               </div>
            </div>

            {/* 5. ABITUDINI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-gray-100">
               <div className="space-y-6">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Info size={18} className="text-tealAction" /> 5. Abitudini di Vita
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                     <div className="flex items-center justify-between bg-warmWhite/30 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <Cigarette size={20} className="text-primary/40" />
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">Fumo</span>
                        </div>
                        <div className="flex gap-2">
                           {['non fumatore', 'ex fumatore', 'fumatore'].map(s => (
                             <button key={s} onClick={() => setAnamnesis({...anamnesis, abitudini: {...anamnesis.abitudini, fumo: {...anamnesis.abitudini.fumo, status: s}}})}
                             className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${anamnesis.abitudini.fumo.status === s ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-300 border border-gray-50'}`}>{s}</button>
                           ))}
                        </div>
                     </div>
                     <div className="flex items-center justify-between bg-warmWhite/30 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <Beer size={20} className="text-primary/40" />
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">Alcol</span>
                        </div>
                        <div className="flex gap-2">
                           {['no', 'occasionale', 'regolare'].map(s => (
                             <button key={s} onClick={() => setAnamnesis({...anamnesis, abitudini: {...anamnesis.abitudini, alcol: s}})}
                             className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${anamnesis.abitudini.alcol === s ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-300 border border-gray-50'}`}>{s}</button>
                           ))}
                        </div>
                     </div>
                     <div className="flex items-center justify-between bg-warmWhite/30 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <Dumbbell size={20} className="text-primary/40" />
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">Attività Fisica</span>
                        </div>
                        <div className="flex gap-2">
                           {['sedentario', 'moderata', 'intensa'].map(s => (
                             <button key={s} onClick={() => setAnamnesis({...anamnesis, abitudini: {...anamnesis.abitudini, attivita_fisica: s}})}
                             className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${anamnesis.abitudini.attivita_fisica === s ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-300 border border-gray-50'}`}>{s}</button>
                           ))}
                        </div>
                     </div>
                     <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Pill size={14} /> Farmaci Abituali</label>
                        <input className="input-standard !py-2 text-xs" value={anamnesis.abitudini.farmaci} onChange={e => setAnamnesis({...anamnesis, abitudini: {...anamnesis.abitudini, farmaci: e.target.value}})} />
                     </div>
                  </div>
               </div>

               {/* 6. ANAMNESI FAMILIARE */}
               <div className="space-y-6">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={18} className="text-primary" /> 6. Anamnesi Familiare
                  </h3>
                  <div className="bg-white border border-gray-100 p-8 rounded-[40px] space-y-6">
                     <div className="flex flex-wrap gap-3">
                        {['Cardiopatie', 'Neoplasie', 'Diabete', 'Ipertensione', 'Malattie Professionali'].map(p => (
                          <button
                            key={p}
                            onClick={() => {
                              const newList = anamnesis.familiare.patologie.includes(p)
                                ? anamnesis.familiare.patologie.filter(item => item !== p)
                                : [...anamnesis.familiare.patologie, p];
                              setAnamnesis({...anamnesis, familiare: {...anamnesis.familiare, patologie: newList}});
                            }}
                            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${anamnesis.familiare.patologie.includes(p) ? 'bg-primary text-white ring-8 ring-primary/5' : 'bg-warmWhite text-gray-300 border border-gray-50'}`}
                          >{p}</button>
                        ))}
                     </div>
                     <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Note Aggiuntive Familiari</label>
                        <textarea className="input-standard h-24 text-xs" value={anamnesis.familiare.note} onChange={e => setAnamnesis({...anamnesis, familiare: {...anamnesis.familiare, note: e.target.value}})} />
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex justify-between mt-12 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(1)} className="px-8 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-primary transition">Indietro</button>
              <button onClick={() => setStep(3)} className="btn-teal px-16 py-4 shadow-2xl shadow-tealAction/20">Prossimo: Esame Obiettivo</button>
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
                <span className="text-2xl font-black text-primary">{(visitForm.peso / ((visitForm.altezza / 100) ** 2)).toFixed(1)}</span>
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
                      value={visitForm[field.id as keyof typeof visitForm]}
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
                      value={visitForm[field.id as keyof typeof visitForm]}
                      onChange={e => setVisitForm({...visitForm, [field.id]: e.target.value})}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(2)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-primary transition">Indietro</button>
              <button onClick={() => setStep(4)} className="btn-teal px-12 py-4 shadow-tealAction/20">Vai al Giudizio</button>
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
              <button onClick={() => setStep(3)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-primary transition">Indietro</button>
              <div className="flex gap-4">
                 <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Visita+Medica:+${workerData.cognome}+${workerData.nome}&dates=${visitForm.scadenza_prossima.replace(/-/g, '')}T090000Z/${visitForm.scadenza_prossima.replace(/-/g, '')}T100000Z&details=Prossima+visita+programmata&sf=true&output=xml`}
                  target="_blank" rel="noopener noreferrer" className="btn-teal px-6 py-5"><RefreshCw size={22} /></a>
                 <button onClick={handleSave} className="btn-accent px-12 py-5 flex items-center gap-3 shadow-2xl shadow-accent/20"><Download size={22} strokeWidth={3} /> Salva e Stampa</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NuovaVisita;
