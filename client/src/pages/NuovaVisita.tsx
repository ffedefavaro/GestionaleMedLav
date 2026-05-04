import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { User, Clipboard, Activity, CheckCircle, Download, Mail, RefreshCw, Heart, Weight, Ruler, Wind, Stethoscope, ChevronDown, ChevronUp, AlertTriangle, Plus, Trash2, Briefcase, ShieldCheck } from 'lucide-react';
import { generateCompletePDF, type Worker as PDFWorker, type Company as PDFCompany, type DoctorProfile as PDFDoctor, type WorkHistory, type FamilyHistory, type PhysiologicalHistory } from '../lib/pdfGenerator';
import { fetchGmailMessages, type GmailMessage, initGapiClient, type TokenResponse, analyzeEmailWithAI } from '../lib/gmail';
import { fetchGmailAttachments } from '../lib/attachments';
import { get } from 'idb-keyval';
import WorkerSearch from '../components/WorkerSearch';
import type { EmailAnalysis } from '../types';

interface Worker {
  id: number;
  nome: string;
  cognome: string;
  mansione: string;
  email: string;
  codice_fiscale: string;
  azienda: string;
  rischi?: string;
  data_nascita?: string;
  luogo_nascita?: string;
  sesso?: string;
  data_assunzione?: string;
}

interface FamilyMemberData {
  patologie: string[];
  note: string;
  deceduto: boolean;
}

interface FamilyHistoryState {
  [key: string]: FamilyMemberData;
}

const FAMILY_MEMBERS = [
  { id: 'padre', label: 'Padre' },
  { id: 'madre', label: 'Madre' },
  { id: 'fratelli_sorelle', label: 'Fratelli / Sorelle' },
  { id: 'nonno_paterno', label: 'Nonno Paterno' },
  { id: 'nonna_paterna', label: 'Nonna Paterna' },
  { id: 'nonno_materno', label: 'Nonno Materno' },
  { id: 'nonna_materna', label: 'Nonna Materna' }
];

const STANDARD_PATHOLOGIES = [
  "Ipertensione",
  "Cardiopatie",
  "Diabete",
  "Ipercolesterolemia",
  "Neoplasie"
];

type RiskFactor =
  | 'Rumore'
  | 'VDT'
  | 'MMC'
  | 'Chimici'
  | 'Polveri'
  | 'Biologico'
  | 'Vibrazioni'
  | 'Posture'
  | 'Turni'
  | 'Stress';

interface WorkExperience {
  azienda: string;
  mansione: string;
  da: string;
  a: string;
  rischi: RiskFactor[];
}

type EOFieldName =
  | 'eo_cardiaca'
  | 'eo_respiratoria'
  | 'eo_cervicale'
  | 'eo_dorsolombare'
  | 'eo_spalle'
  | 'eo_arti_superiori'
  | 'eo_arti_inferiori'
  | 'eo_altro';

interface PhysioState {
  fumo: 'Non fumatore' | 'Ex fumatore' | 'Fumatore';
  sigarette_die: number | string;
  alcol: 'No' | 'Occasionale' | 'Quotidiano';
  attivita_fisica: 'Sedentario' | 'Leggera' | 'Moderata' | 'Intensa';
  sonno: 'Buono' | 'Disturbi' | 'Insonnia';
  farmaci_abituali: string;
  allergie: {
    nessuna: boolean;
    dettaglio: string;
  };
  note_extra: string;
}

interface VisitForm {
  data_visita: string;
  tipo_visita: string;
  anamnesi_lavorativa: WorkExperience[];
  anamnesi_patologica_remota: string;
  anamnesi_patologica_prossima: string;
  servizio_leva: string;
  vaccinazioni: string;
  giudizio: string;
  prescrizioni: string;
  accertamenti_effettuati: string;
  scadenza_prossima: string;
  peso: number | string;
  altezza: number | string;
  p_sistolica: number | string;
  p_diastolica: number | string;
  frequenza: number | string;
  spo2: number | string;
  eo_cardiaca: string;
  eo_respiratoria: string;
  eo_cervicale: string;
  eo_dorsolombare: string;
  eo_spalle: string;
  eo_arti_superiori: string;
  eo_arti_inferiori: string;
  eo_altro: string;
  incidenti_invalidita: string;
  conclusioni: string;
}

const NuovaVisita = () => {
  const [lavoratori, setLavoratori] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  const [step, setStep] = useState(1);

  // Gmail State
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [emailAnalyses, setEmailAnalyses] = useState<Record<string, EmailAnalysis | 'loading' | 'error'>>({});

  // Structured History States
  const initialFamilyHistory: FamilyHistoryState = FAMILY_MEMBERS.reduce((acc, member) => ({
    ...acc,
    [member.id]: { patologie: [], note: '', deceduto: false }
  }), {});
  const [familyHistory, setFamilyHistory] = useState<FamilyHistoryState>(initialFamilyHistory);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  const [physioState, setPhysioState] = useState<PhysioState>({
    fumo: 'Non fumatore',
    sigarette_die: '',
    alcol: 'No',
    attivita_fisica: 'Sedentario',
    sonno: 'Buono',
    farmaci_abituali: '',
    allergie: { nessuna: true, dettaglio: '' },
    note_extra: ''
  });

  const [visitForm, setVisitForm] = useState<VisitForm>({
    data_visita: new Date().toISOString().split('T')[0],
    tipo_visita: 'periodica',
    anamnesi_lavorativa: [],
    anamnesi_patologica_remota: '',
    anamnesi_patologica_prossima: '',
    servizio_leva: 'Non svolto',
    vaccinazioni: '',
    giudizio: 'idoneo',
    prescrizioni: '',
    accertamenti_effettuati: '',
    scadenza_prossima: '',
    peso: '',
    altezza: '',
    p_sistolica: '',
    p_diastolica: '',
    frequenza: '',
    spo2: '',
    eo_cardiaca: '',
    eo_respiratoria: '',
    eo_cervicale: '',
    eo_dorsolombare: '',
    eo_spalle: '',
    eo_arti_superiori: '',
    eo_arti_inferiori: '',
    eo_altro: '',
    incidenti_invalidita: '',
    conclusioni: ''
  });

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = () => {
    const data = executeQuery(`
      SELECT workers.*, companies.ragione_sociale as azienda
      FROM workers
      JOIN companies ON workers.company_id = companies.id
    `);
    setLavoratori(data as Worker[]);
  };

  useEffect(() => {
    if (selectedWorkerId) {
      const data = lavoratori.find(l => l.id.toString() === selectedWorkerId);
      if (data) {
        setWorkerData(data);

        const fullWorkerResults = executeQuery(`
          SELECT workers.*, protocols.periodicita_mesi as protocol_periodicity
          FROM workers
          LEFT JOIN protocols ON workers.protocol_id = protocols.id
          WHERE workers.id = ?
        `, [selectedWorkerId]);

        const fullWorker = fullWorkerResults[0];

        if (fullWorker) {
          let months = (fullWorker.protocol_periodicity as number) || 12;
          if (fullWorker.is_protocol_customized && fullWorker.custom_protocol) {
            try {
              const customExams = JSON.parse(fullWorker.custom_protocol as string);
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

  const handleGmailSync = async () => {
    const clientId = await get('google_client_id');
    if (!clientId) {
      alert("Configura il Client ID nelle impostazioni prima di usare Gmail.");
      return;
    }

    setLoadingGmail(true);
    try {
      await initGapiClient();
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: async (response: TokenResponse) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            const msgs = await fetchGmailMessages(response.access_token, workerData?.email ?? '');
            setGmailMessages(msgs);
          }
          setLoadingGmail(false);
        },
      });
      tokenClient.requestAccessToken();
    } catch (e) {
      console.error(e);
      setLoadingGmail(false);
    }
  };

  const handleAnalyzeEmail = async (msg: GmailMessage) => {
    setEmailAnalyses(prev => ({ ...prev, [msg.id]: 'loading' }));
    try {
      const attachments = accessToken ? await fetchGmailAttachments(accessToken, msg.id) : [];
      const analysis = await analyzeEmailWithAI(msg, attachments);
      setEmailAnalyses(prev => ({ ...prev, [msg.id]: analysis }));
    } catch (e) {
      console.error("Analisi AI fallita:", e);
      setEmailAnalyses(prev => ({ ...prev, [msg.id]: 'error' }));
    }
  };

  const importAnalysis = (analysis: EmailAnalysis) => {
    const testo = [
      analysis.tipoEsame.length > 0 ? `Esami: ${analysis.tipoEsame.join(', ')}` : '',
      analysis.dataEsame ? `Data: ${analysis.dataEsame}` : '',
      `\n${analysis.diagnosi}`,
      analysis.valoriAnomali.length > 0 ? `\nAnomalie: ${analysis.valoriAnomali.join(' | ')}` : '',
      analysis.notePerMedico ? `\nNote: ${analysis.notePerMedico}` : ''
    ].filter(Boolean).join('\n');

    setVisitForm(prev => ({
      ...prev,
      anamnesi_patologica_remota: (prev.anamnesi_patologica_remota ? prev.anamnesi_patologica_remota + "\n\n" : "") + testo
    }));
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
      anamnesi_patologica_remota: (prev.anamnesi_patologica_remota ? prev.anamnesi_patologica_remota + "\n\n" : "") + textToImport
    }));
    alert("Testo e allegati importati in Anamnesi Patologica Remota!");
  };

  const handleSave = async () => {
    if (!selectedWorkerId || !workerData) return;

    const fisioJSON = JSON.stringify({
      fumo: physioState.fumo + (physioState.fumo === 'Fumatore' ? ` (${physioState.sigarette_die} sig/die)` : ''),
      alcol: physioState.alcol,
      farmaci_abituali: physioState.farmaci_abituali,
      servizio_leva: visitForm.servizio_leva,
      note_extra: physioState.note_extra
    });

    await runCommand(`
      INSERT INTO visits (
        worker_id, data_visita, tipo_visita, anamnesi_lavorativa, anamnesi_familiare,
        anamnesi_patologica_remota, anamnesi_patologica_prossima, anamnesi_fisiologica, allergie, vaccinazioni,
        accertamenti_effettuati, eo_cardiaca, eo_respiratoria, eo_cervicale, eo_dorsolombare,
        eo_spalle, eo_arti_superiori, eo_arti_inferiori, eo_altro, incidenti_invalidita, conclusioni,
        giudizio, prescrizioni, scadenza_prossima, finalized
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      selectedWorkerId, visitForm.data_visita, visitForm.tipo_visita,
      JSON.stringify(visitForm.anamnesi_lavorativa),
      JSON.stringify(familyHistory),
      visitForm.anamnesi_patologica_remota,
      visitForm.anamnesi_patologica_prossima,
      fisioJSON,
      physioState.allergie.nessuna ? 'Nessuna' : physioState.allergie.dettaglio,
      visitForm.vaccinazioni,
      visitForm.accertamenti_effettuati, visitForm.eo_cardiaca, visitForm.eo_respiratoria,
      visitForm.eo_cervicale, visitForm.eo_dorsolombare, visitForm.eo_spalle,
      visitForm.eo_arti_superiori, visitForm.eo_arti_inferiori, visitForm.eo_altro,
      visitForm.incidenti_invalidita, visitForm.conclusioni,
      visitForm.giudizio, visitForm.prescrizioni, visitForm.scadenza_prossima
    ]);

    const lastVisitResults = executeQuery("SELECT id FROM visits ORDER BY id DESC LIMIT 1");
    const lastVisitData = lastVisitResults[0];

    if (lastVisitData) {
      await runCommand(
        "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
        ["FINALIZE", "visits", lastVisitData.id as number, `Visita finalizzata per lavoratore ID: ${selectedWorkerId}`]
      );

      const peso = typeof visitForm.peso === 'number' ? visitForm.peso : parseFloat(visitForm.peso as string) || 0;
      const altezza = typeof visitForm.altezza === 'number' ? visitForm.altezza : parseFloat(visitForm.altezza as string) || 1;
      const bmi = peso / ((altezza / 100) ** 2);

      await runCommand(`
        INSERT INTO biometrics (visit_id, peso, altezza, bmi, pressione_sistolica, pressione_diastolica, frequenza_cardiaca, spo2)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        lastVisitData.id,
        visitForm.peso || null,
        visitForm.altezza || null,
        visitForm.peso && visitForm.altezza ? bmi : null,
        visitForm.p_sistolica || null,
        visitForm.p_diastolica || null,
        visitForm.frequenza || null,
        visitForm.spo2 || null
      ]);
    }

    alert("Visita salvata con successo!");
    handleGeneratePDF();
    setStep(1);
    setSelectedWorkerId('');
  };

  const handleGeneratePDF = () => {
    if (!workerData) return;

    const doctorDataResults = executeQuery("SELECT * FROM doctor_profile WHERE id = 1");
    const doctorData = (doctorDataResults[0] || { nome: '', specializzazione: '', n_iscrizione: '' }) as PDFDoctor;

    const companyDataResults = executeQuery("SELECT * FROM companies WHERE id = (SELECT company_id FROM workers WHERE id = ?)", [selectedWorkerId]);
    const companyData = (companyDataResults[0] || {}) as PDFCompany;

    const physioHist: PhysiologicalHistory = {
        sviluppo: { gravidanza_parto: 'Regolari', psicomotorio: 'Regolare' },
        puberta: { sviluppo_puberale: 'Regolare', menopausa: false },
        abitudini: {
            fumo: physioState.fumo,
            fumo_sigarette_die: parseInt(physioState.sigarette_die as string) || 0,
            alcol: physioState.alcol,
            attivita_fisica: physioState.attivita_fisica,
            dieta: 'Onnivora',
            farmaci_abituali: physioState.farmaci_abituali,
            nessuna_allergia: physioState.allergie.nessuna,
            allergie_note: physioState.allergie.dettaglio
        },
        sonno: { qualita: physioState.sonno as any }
    };

    const famHist: FamilyHistory = FAMILY_MEMBERS.reduce((acc, m) => ({
        ...acc,
        [m.id]: {
            deceduto: familyHistory[m.id].deceduto,
            patologie: familyHistory[m.id].patologie,
            altro_note: familyHistory[m.id].note
        }
    }), {} as FamilyHistory);

    const workHist: WorkHistory = {
        esperienze: visitForm.anamnesi_lavorativa.map(exp => ({
            azienda: exp.azienda,
            mansione: exp.mansione,
            dal: exp.da,
            al: exp.a,
            esposizioni: exp.rischi
        })),
        infortuni: 'Nessuno',
        malattie_professionali: 'No'
    };

    const risksArr: string[] = workerData.rischi ? JSON.parse(workerData.rischi) : [];

    const doc = generateCompletePDF({
      mode: 'combined',
      visit: {
          ...visitForm,
          anamnesi_lavorativa: JSON.stringify(visitForm.anamnesi_lavorativa),
          anamnesi_familiare: JSON.stringify(familyHistory),
          peso: parseFloat(visitForm.peso as string) || undefined,
          altezza: parseFloat(visitForm.altezza as string) || undefined,
          bmi: parseFloat(calculateBMI()),
          p_sistolica: parseInt(visitForm.p_sistolica as string) || undefined,
          p_diastolica: parseInt(visitForm.p_diastolica as string) || undefined,
          frequenza: parseInt(visitForm.frequenza as string) || undefined,
          spo2: parseInt(visitForm.spo2 as string) || undefined
      },
      worker: workerData as unknown as PDFWorker,
      company: companyData,
      doctor: doctorData,
      familyHistory: famHist,
      physioHistory: physioHist,
      workHistory: workHist,
      risks: risksArr
    });

    doc.save(`Cartella_3A_${workerData.cognome}_${visitForm.data_visita}.pdf`);
  };

  const calculateBMI = () => {
    const peso = typeof visitForm.peso === 'number' ? visitForm.peso : parseFloat(visitForm.peso as string);
    const altezza = typeof visitForm.altezza === 'number' ? visitForm.altezza : parseFloat(visitForm.altezza as string);
    if (peso && altezza) {
      return (peso / ((altezza / 100) ** 2)).toFixed(1);
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
                <button onClick={handleGmailSync} disabled={loadingGmail} className="btn-accent flex items-center gap-2 text-xs py-2 px-4">
                  {loadingGmail ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />} Sincronizza
                </button>
              </div>
              {gmailMessages.length > 0 && (
                <div className="space-y-3">
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {gmailMessages.map(msg => {
                        const analysis = emailAnalyses[msg.id];
                        return (
                          <div key={msg.id} className="bg-white/80 rounded-xl border border-accent/10 overflow-hidden">
                            <div className="p-3 text-[10px] flex justify-between items-center gap-4">
                              <div className="flex-1 font-bold">[{msg.date}] {msg.snippet}</div>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={() => handleAnalyzeEmail(msg)}
                                  disabled={analysis === 'loading'}
                                  className="text-primary hover:underline font-black uppercase tracking-tighter"
                                >
                                  {analysis === 'loading' ? '⏳ Analisi...' : '🔍 Analizza'}
                                </button>
                                <button
                                  onClick={() => importEmailText(msg)}
                                  className="text-accent hover:underline font-black uppercase tracking-tighter"
                                >
                                  Importa testo
                                </button>
                              </div>
                            </div>

                            {analysis && analysis !== 'loading' && analysis !== 'error' && (
                              <div className="border-t border-accent/10 bg-primary/5 p-3 space-y-2 text-[10px]">
                                {analysis.tipoEsame.length > 0 && (
                                  <div className="flex gap-2 flex-wrap">
                                    {analysis.tipoEsame.map(t => (
                                      <span key={t} className="bg-primary text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">{t}</span>
                                    ))}
                                    {analysis.dataEsame && <span className="text-gray-400 font-bold">{analysis.dataEsame}</span>}
                                  </div>
                                )}
                                <p className="text-gray-700 font-bold leading-relaxed">{analysis.diagnosi}</p>
                                {analysis.valoriAnomali.length > 0 && (
                                  <div className="bg-red-50 border border-red-100 rounded-lg p-2">
                                    <span className="text-red-600 font-black uppercase tracking-tighter">⚠ Anomalie: </span>
                                    <span className="text-red-700">{analysis.valoriAnomali.join(' · ')}</span>
                                  </div>
                                )}
                                {analysis.notePerMedico && (
                                  <p className="text-gray-500 italic">{analysis.notePerMedico}</p>
                                )}
                                <button
                                  onClick={() => importAnalysis(analysis)}
                                  className="btn-accent text-[10px] py-1 px-3 mt-1"
                                >
                                  ✓ Importa riepilogo in Anamnesi
                                </button>
                              </div>
                            )}
                            {analysis === 'error' && (
                              <div className="border-t border-red-100 bg-red-50 p-2 text-[10px] text-red-500 font-bold">
                                Analisi fallita. Usa "Importa testo" come fallback.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                </div>
              )}
            </div>

            <div className="space-y-12">
              {/* ANAMNESI FAMILIARE STRUTTURATA */}
              <div className="space-y-6">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Heart size={14} /> Anamnesi Familiare
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {FAMILY_MEMBERS.map((member) => {
                    const data = familyHistory[member.id];
                    const isAnomaly = data.patologie.length > 0 || data.note.trim() !== '' || data.deceduto;
                    const isExpanded = expandedMembers[member.id] || isAnomaly;

                    return (
                      <div
                        key={member.id}
                        className={`bg-white rounded-3xl border-2 transition-all duration-300 overflow-hidden ${
                          isAnomaly ? 'border-amber-500/50 bg-amber-50/5' : 'border-gray-50'
                        }`}
                      >
                        <div
                          className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 transition-colors"
                          onClick={() => setExpandedMembers(prev => ({ ...prev, [member.id]: !prev[member.id] }))}
                        >
                          <div className="flex items-center gap-3">
                            {isAnomaly && <AlertTriangle size={16} className="text-amber-500" strokeWidth={3} />}
                            <span className="font-black text-primary text-sm uppercase tracking-tight">{member.label}</span>
                            {!isExpanded && !isAnomaly && <span className="text-[10px] font-bold text-gray-400 ml-2">Nella norma</span>}
                          </div>
                          <div className="text-gray-300">
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 gap-3">
                              {STANDARD_PATHOLOGIES.map((pat) => (
                                <label key={pat} className="flex items-center gap-2 group cursor-pointer">
                                  <div className="relative flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      className="peer appearance-none w-5 h-5 border-2 border-gray-100 rounded-lg checked:bg-amber-500 checked:border-amber-500 transition-all cursor-pointer"
                                      checked={data.patologie.includes(pat)}
                                      onChange={(e) => {
                                        const newPat = e.target.checked
                                          ? [...data.patologie, pat]
                                          : data.patologie.filter(p => p !== pat);
                                        setFamilyHistory(prev => ({
                                          ...prev,
                                          [member.id]: { ...data, patologie: newPat }
                                        }));
                                      }}
                                    />
                                    <CheckCircle className="absolute text-white scale-0 peer-checked:scale-75 transition-transform" size={14} strokeWidth={4} />
                                  </div>
                                  <span className="text-[11px] font-bold text-gray-500 group-hover:text-primary transition-colors leading-none">{pat}</span>
                                </label>
                              ))}
                            </div>
                            <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stato in vita</span>
                                <button
                                    onClick={() => setFamilyHistory(prev => ({ ...prev, [member.id]: { ...data, deceduto: !data.deceduto } }))}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${data.deceduto ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
                                >
                                    {data.deceduto ? 'Deceduto' : 'In Vita'}
                                </button>
                            </div>
                            <textarea
                                className="input-standard h-20 text-[11px] py-3 bg-warmWhite/50"
                                placeholder="Eventuali precisazioni..."
                                value={data.note}
                                onChange={(e) => setFamilyHistory(prev => ({
                                  ...prev,
                                  [member.id]: { ...data, note: e.target.value }
                                }))}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ANAMNESI FISIOLOGICA */}
              <div className="space-y-6">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Activity size={14} /> Anamnesi Fisiologica
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-warmWhite/30 p-8 rounded-[32px] border border-gray-100">
                  <div className="space-y-6">
                    {/* FUMO */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Fumo</label>
                      <div className="flex flex-wrap gap-2">
                        {(['Non fumatore', 'Ex fumatore', 'Fumatore'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setPhysioState({ ...physioState, fumo: opt })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${physioState.fumo === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      {physioState.fumo === 'Fumatore' && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                          <input
                            type="number"
                            placeholder="N° sigarette/die"
                            className="input-standard text-xs py-2 h-10"
                            value={physioState.sigarette_die}
                            onChange={(e) => setPhysioState({ ...physioState, sigarette_die: e.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    {/* ALCOL */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Alcol</label>
                      <div className="flex flex-wrap gap-2">
                        {(['No', 'Occasionale', 'Quotidiano'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setPhysioState({ ...physioState, alcol: opt })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${physioState.alcol === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ATTIVITA FISICA */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Attività Fisica</label>
                      <div className="flex flex-wrap gap-2">
                        {(['Sedentario', 'Leggera', 'Moderata', 'Intensa'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setPhysioState({ ...physioState, attivita_fisica: opt })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${physioState.attivita_fisica === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Servizio di Leva</label>
                      <div className="flex flex-wrap gap-2">
                        {(['Svolto', 'Non svolto', 'Esonerato'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisitForm({ ...visitForm, servizio_leva: opt })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visitForm.servizio_leva === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Sonno</label>
                      <div className="flex flex-wrap gap-2">
                        {(['Buono', 'Disturbi', 'Insonnia'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setPhysioState({ ...physioState, sonno: opt })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${physioState.sonno === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Farmaci abituali</label>
                      <input
                        type="text"
                        className="input-standard text-xs py-2 h-10"
                        value={physioState.farmaci_abituali}
                        onChange={(e) => setPhysioState({ ...physioState, farmaci_abituali: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Allergie</label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            checked={physioState.allergie.nessuna}
                            onChange={(e) => setPhysioState({ ...physioState, allergie: { ...physioState.allergie, nessuna: e.target.checked, dettaglio: e.target.checked ? '' : physioState.allergie.dettaglio } })}
                          />
                          <span className="text-[10px] font-bold text-gray-600">Nessuna</span>
                        </label>
                        {!physioState.allergie.nessuna && (
                          <input
                            type="text"
                            placeholder="Specifica allergie..."
                            className="input-standard text-xs py-2 h-10 flex-1 animate-in fade-in slide-in-from-left-2 duration-300"
                            value={physioState.allergie.dettaglio}
                            onChange={(e) => setPhysioState({ ...physioState, allergie: { ...physioState.allergie, dettaglio: e.target.value } })}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ANAMNESI PATOLOGICA */}
              <div className="space-y-6">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Stethoscope size={14} /> Anamnesi Patologica
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Patologica Remota (Passata)</label>
                    <textarea
                      className="input-standard h-24 text-xs"
                      placeholder="Interventi, malattie pregresse..."
                      value={visitForm.anamnesi_patologica_remota}
                      onChange={e => setVisitForm({...visitForm, anamnesi_patologica_remota: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Patologica Prossima (Attuale)</label>
                    <textarea
                      className="input-standard h-24 text-xs"
                      placeholder="Sintomi attuali, disturbi recenti..."
                      value={visitForm.anamnesi_patologica_prossima}
                      onChange={e => setVisitForm({...visitForm, anamnesi_patologica_prossima: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Incidenti e Invalidità</label>
                    <textarea
                      className="input-standard h-24 text-xs"
                      placeholder="Eventuali incidenti o invalidità..."
                      value={visitForm.incidenti_invalidita}
                      onChange={e => setVisitForm({...visitForm, incidenti_invalidita: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <ShieldCheck size={14} /> Vaccinazioni
                    </label>
                    <textarea
                        className="input-standard h-24 text-xs"
                        placeholder="Antitetanica, Epatite B, etc..."
                        value={visitForm.vaccinazioni}
                        onChange={e => setVisitForm({...visitForm, vaccinazioni: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* ANAMNESI LAVORATIVA */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Briefcase size={14} /> Anamnesi Lavorativa
                  </label>
                  <button
                    onClick={() => {
                      const newExp: WorkExperience = { azienda: '', mansione: '', da: '', a: '', rischi: [] };
                      setVisitForm({ ...visitForm, anamnesi_lavorativa: [...visitForm.anamnesi_lavorativa, newExp] });
                    }}
                    className="btn-teal py-2 px-4 text-[10px] flex items-center gap-2"
                  >
                    <Plus size={14} /> Aggiungi Esperienza
                  </button>
                </div>

                <div className="space-y-4">
                  {visitForm.anamnesi_lavorativa.map((exp, idx) => {
                    const availableRisks: RiskFactor[] = [
                      'Rumore', 'VDT', 'MMC', 'Chimici', 'Polveri',
                      'Biologico', 'Vibrazioni', 'Posture', 'Turni', 'Stress'
                    ];

                    const updateExp = (field: keyof WorkExperience, value: string | RiskFactor[]) => {
                      const newLavorativa = [...visitForm.anamnesi_lavorativa];
                      newLavorativa[idx] = { ...newLavorativa[idx], [field]: value } as WorkExperience;
                      setVisitForm({ ...visitForm, anamnesi_lavorativa: newLavorativa });
                    };

                    const toggleRisk = (risk: RiskFactor) => {
                      const currentRisks = exp.rischi;
                      const newRisks = currentRisks.includes(risk)
                        ? currentRisks.filter(r => r !== risk)
                        : [...currentRisks, risk];
                      updateExp('rischi', newRisks);
                    };

                    const removeExp = () => {
                      setVisitForm({
                        ...visitForm,
                        anamnesi_lavorativa: visitForm.anamnesi_lavorativa.filter((_, i) => i !== idx)
                      });
                    };

                    return (
                      <div key={idx} className="bg-white border border-gray-100 p-6 rounded-[32px] space-y-4 relative group hover:border-primary/20 transition-all">
                        <button
                          onClick={removeExp}
                          className="absolute top-6 right-6 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-1 space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Azienda</label>
                            <input
                              type="text"
                              className="input-standard h-10 text-xs"
                              value={exp.azienda}
                              onChange={(e) => updateExp('azienda', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-1 space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Mansione</label>
                            <input
                              type="text"
                              className="input-standard h-10 text-xs"
                              value={exp.mansione}
                              onChange={(e) => updateExp('mansione', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Da (anno)</label>
                            <input
                              type="number"
                              className="input-standard h-10 text-xs"
                              placeholder="AAAA"
                              value={exp.da}
                              onChange={(e) => updateExp('da', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">A (anno)</label>
                            <input
                              type="number"
                              className="input-standard h-10 text-xs"
                              placeholder="AAAA"
                              value={exp.a}
                              onChange={(e) => updateExp('a', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Rischi Professionali</label>
                          <div className="flex flex-wrap gap-2">
                            {availableRisks.map(risk => (
                              <button
                                key={risk}
                                onClick={() => toggleRisk(risk)}
                                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${exp.rischi.includes(risk) ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-warmWhite text-gray-400 border border-gray-100 hover:border-accent/20'}`}
                              >
                                {risk}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary/40"><Heart size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Sistolica</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitForm.p_sistolica} onChange={e => setVisitForm({...visitForm, p_sistolica: e.target.value})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">mmHg</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary/40"><Heart size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Diastolica</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitForm.p_diastolica} onChange={e => setVisitForm({...visitForm, p_diastolica: e.target.value})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">mmHg</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-tealAction/40"><Activity size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Frequenza</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-tealAction outline-none" value={visitForm.frequenza} onChange={e => setVisitForm({...visitForm, frequenza: e.target.value})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">bpm</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-accent/40"><Weight size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Peso</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-accent outline-none" value={visitForm.peso} onChange={e => setVisitForm({...visitForm, peso: e.target.value})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">kg</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-accent/40"><Ruler size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Altezza</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-accent outline-none" value={visitForm.altezza} onChange={e => setVisitForm({...visitForm, altezza: e.target.value})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">cm</span>
              </div>
              <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 flex flex-col justify-center items-center gap-1">
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">BMI</span>
                <span className="text-2xl font-black text-primary">{calculateBMI()}</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary/40"><Wind size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">SpO2 %</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitForm.spo2} onChange={e => setVisitForm({...visitForm, spo2: e.target.value})} />
              </div>
            </div>

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
                      value={visitForm[field.id as EOFieldName]}
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
                      value={visitForm[field.id as EOFieldName]}
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
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Conclusioni</label>
                <textarea className="input-standard h-20" value={visitForm.conclusioni} onChange={e => setVisitForm({...visitForm, conclusioni: e.target.value})} />
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
