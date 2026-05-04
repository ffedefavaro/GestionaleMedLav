import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { User, Clipboard, Activity, CheckCircle, Download, Mail, RefreshCw, Heart, Weight, Ruler, Wind, Stethoscope, ChevronDown, ChevronUp, Plus, Trash2, Briefcase, ShieldCheck } from 'lucide-react';
import { generateCompletePDF, type Visit as PDFVisit, type Worker as PDFWorker, type Company as PDFCompany, type DoctorProfile as PDFDoctor } from '../lib/pdfGenerator';
import { fetchGmailMessages, type GmailMessage, initGapiClient, type TokenResponse } from '../lib/gmail';
import { fetchGmailAttachments } from '../lib/attachments';
import { get } from 'idb-keyval';
import WorkerSearch from '../components/WorkerSearch';

interface Worker {
  id: number;
  nome: string;
  cognome: string;
  mansione: string;
  email: string;
  codice_fiscale: string;
  azienda: string;
}

type FamilyPatology =
  | 'Ipertensione'
  | 'Cardiopatie'
  | 'Diabete'
  | 'Neoplasie'
  | 'Malattie polmonari'
  | 'Renali'
  | 'Neurologiche'
  | 'Psichiatriche'
  | 'Professionali'
  | 'Altro';

interface FamilyMember {
  parentela: string;
  patologie: FamilyPatology[];
  deceduto: boolean;
}

interface PhysiologicalHistory {
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

interface VisitForm {
  data_visita: string;
  tipo_visita: string;
  anamnesi_lavorativa: WorkExperience[];
  anamnesi_familiare: FamilyMember[];
  anamnesi_patologica: PhysiologicalHistory; // Legacy field for internal state
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
  incidenti_invalidita: string; // <!-- MODIFICA -->
  conclusioni: string; // <!-- MODIFICA -->
}

const FamilyMemberCard = ({
  member,
  onChange
}: {
  member: FamilyMember;
  onChange: (updated: FamilyMember) => void
}) => {
  const [expanded, setExpanded] = useState(false);
  const pathologies: FamilyPatology[] = [
    'Ipertensione', 'Cardiopatie', 'Diabete', 'Neoplasie',
    'Malattie polmonari', 'Renali', 'Neurologiche',
    'Psichiatriche', 'Professionali', 'Altro'
  ];

  const togglePathology = (pat: FamilyPatology) => {
    const currentPats = member.patologie;
    const newPatologie = currentPats.includes(pat)
      ? currentPats.filter(p => p !== pat)
      : [...currentPats, pat];
    onChange({ ...member, patologie: newPatologie });
  };

  const toggleDeceduto = () => {
    onChange({ ...member, deceduto: !member.deceduto });
  };

  const summary = member.patologie.length > 0
    ? member.patologie.join(', ') + (member.deceduto ? ' (Deceduto)' : '')
    : (member.deceduto ? 'Deceduto (No patologie segnalate)' : 'Nulla da segnalare');

  return (
    <div className={`border rounded-2xl p-4 transition-all ${expanded ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10' : 'bg-white border-gray-100 hover:border-primary/20'}`}>
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div>
          <p className="text-[10px] font-black text-primary uppercase tracking-tighter">{member.parentela}</p>
          {!expanded && <p className="text-xs font-medium text-gray-500 truncate max-w-[200px]">{summary}</p>}
        </div>
        {expanded ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-gray-300" />}
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-2 gap-2">
            {pathologies.map(pat => (
              <label key={pat} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary h-3 w-3"
                  checked={member.patologie.includes(pat)}
                  onChange={() => togglePathology(pat)}
                />
                <span className="text-[10px] font-bold text-gray-600 group-hover:text-primary transition-colors">{pat}</span>
              </label>
            ))}
          </div>
          <div className="pt-3 border-t border-primary/10 flex items-center justify-between">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stato in vita</span>
             <button
              onClick={toggleDeceduto}
              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${member.deceduto ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
             >
              {member.deceduto ? 'Deceduto' : 'In Vita'}
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

const NuovaVisita = () => {
  const [lavoratori, setLavoratori] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  const [step, setStep] = useState(1);

  // Gmail State
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [visitForm, setVisitForm] = useState<VisitForm>({
    data_visita: new Date().toISOString().split('T')[0],
    tipo_visita: 'periodica',
    anamnesi_lavorativa: [],
    anamnesi_familiare: [
      { parentela: 'Padre', patologie: [], deceduto: false },
      { parentela: 'Madre', patologie: [], deceduto: false },
      { parentela: 'Fratelli', patologie: [], deceduto: false },
      { parentela: 'Nonno paterno', patologie: [], deceduto: false },
      { parentela: 'Nonna paterna', patologie: [], deceduto: false },
      { parentela: 'Nonno materno', patologie: [], deceduto: false },
      { parentela: 'Nonna materna', patologie: [], deceduto: false },
    ],
    anamnesi_patologica: {
      fumo: 'Non fumatore',
      sigarette_die: '',
      alcol: 'No',
      attivita_fisica: 'Sedentario',
      sonno: 'Buono',
      farmaci_abituali: '',
      allergie: { nessuna: true, dettaglio: '' },
      note_extra: ''
    },
    anamnesi_patologica_remota: '',
    anamnesi_patologica_prossima: '',
    servizio_leva: 'Non svolto',
    vaccinazioni: '',
    giudizio: 'idoneo',
    prescrizioni: '',
    accertamenti_effettuati: '',
    scadenza_prossima: '',
    // Biometrics
    peso: '',
    altezza: '',
    p_sistolica: '',
    p_diastolica: '',
    frequenza: '',
    spo2: '',
    // Structured Physical Exam
    eo_cardiaca: '',
    eo_respiratoria: '',
    eo_cervicale: '',
    eo_dorsolombare: '',
    eo_spalle: '',
    eo_arti_superiori: '',
    eo_arti_inferiori: '',
    eo_altro: '',
    incidenti_invalidita: '', // <!-- MODIFICA -->
    conclusioni: '' // <!-- MODIFICA -->
  });

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = () => {
    const data = executeQuery(`
      SELECT workers.id, workers.nome, workers.cognome, workers.mansione, workers.email, workers.codice_fiscale, companies.ragione_sociale as azienda
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
            // Fix instruction 1: workerData?.email ?? ''
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
      anamnesi_patologica: {
        ...prev.anamnesi_patologica,
        note_extra: prev.anamnesi_patologica.note_extra + (prev.anamnesi_patologica.note_extra ? "\n\n" : "") + textToImport
      }
    }));
    alert("Testo e allegati importati in Anamnesi Patologica!");
  };

  const handleSave = async () => {
    if (!selectedWorkerId || !workerData) return;

    const fisioJSON = JSON.stringify({
      fumo: visitForm.anamnesi_patologica.fumo + (visitForm.anamnesi_patologica.fumo === 'Fumatore' ? ` (${visitForm.anamnesi_patologica.sigarette_die} sig/die)` : ''),
      alcol: visitForm.anamnesi_patologica.alcol,
      farmaci_abituali: visitForm.anamnesi_patologica.farmaci_abituali,
      servizio_leva: visitForm.servizio_leva,
      note_extra: visitForm.anamnesi_patologica.note_extra
    });

    // 1. Insert Visit with structured exam fields
    await runCommand(`
      INSERT INTO visits (
        worker_id, data_visita, tipo_visita, anamnesi_lavorativa, anamnesi_familiare, anamnesi_patologica,
        anamnesi_patologica_remota, anamnesi_patologica_prossima, anamnesi_fisiologica, allergie, vaccinazioni,
        accertamenti_effettuati, eo_cardiaca, eo_respiratoria, eo_cervicale, eo_dorsolombare,
        eo_spalle, eo_arti_superiori, eo_arti_inferiori, eo_altro, giudizio, prescrizioni, scadenza_prossima, finalized
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      selectedWorkerId, visitForm.data_visita, visitForm.tipo_visita,
      JSON.stringify(visitForm.anamnesi_lavorativa),
      JSON.stringify(visitForm.anamnesi_familiare),
      JSON.stringify(visitForm.anamnesi_patologica), // Keep for legacy if needed, or use as catch-all
      visitForm.anamnesi_patologica_remota,
      visitForm.anamnesi_patologica_prossima,
      fisioJSON,
      visitForm.anamnesi_patologica.allergie.nessuna ? 'Nessuna' : visitForm.anamnesi_patologica.allergie.dettaglio,
      visitForm.vaccinazioni,
      visitForm.accertamenti_effettuati, visitForm.eo_cardiaca, visitForm.eo_respiratoria,
      visitForm.eo_cervicale, visitForm.eo_dorsolombare, visitForm.eo_spalle,
      visitForm.eo_arti_superiori, visitForm.eo_arti_inferiori, visitForm.eo_altro,
      visitForm.giudizio, visitForm.prescrizioni, visitForm.scadenza_prossima
    ]);

    const lastVisitResults = executeQuery("SELECT id FROM visits ORDER BY id DESC LIMIT 1");
    const lastVisitData = lastVisitResults[0];

    // Log action for legal audit
    if (lastVisitData) {
      await runCommand(
        "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
        ["FINALIZE", "visits", lastVisitData.id as number, `Visita finalizzata per lavoratore ID: ${selectedWorkerId}`]
      );

      // 2. Insert Biometrics
      const peso = typeof visitForm.peso === 'number' ? visitForm.peso : parseFloat(visitForm.peso as string) || 0;
      const altezza = typeof visitForm.altezza === 'number' ? visitForm.altezza : parseFloat(visitForm.altezza as string) || 1; // avoid div by zero
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
    generatePDF();
    setStep(1);
    setSelectedWorkerId('');
  };

  const generatePDF = () => {
    if (!workerData) return;

    const doctorDataResults = executeQuery("SELECT * FROM doctor_profile WHERE id = 1");
    const doctorData = (doctorDataResults[0] || { nome: '', specializzazione: '', n_iscrizione: '' }) as PDFDoctor;

    const companyDataResults = executeQuery("SELECT * FROM companies WHERE id = (SELECT company_id FROM workers WHERE id = ?)", [selectedWorkerId]);
    const companyData = (companyDataResults[0] || {}) as PDFCompany;

    const fisioJSON = JSON.stringify({
      fumo: visitForm.anamnesi_patologica.fumo + (visitForm.anamnesi_patologica.fumo === 'Fumatore' ? ` (${visitForm.anamnesi_patologica.sigarette_die} sig/die)` : ''),
      alcol: visitForm.anamnesi_patologica.alcol,
      farmaci_abituali: visitForm.anamnesi_patologica.farmaci_abituali,
      servizio_leva: visitForm.servizio_leva,
      note_extra: visitForm.anamnesi_patologica.note_extra
    });

    const workHistoryText = visitForm.anamnesi_lavorativa.length > 0
      ? visitForm.anamnesi_lavorativa.map(exp => `${exp.da}-${exp.a || 'oggi'}: ${exp.azienda} (${exp.mansione}) - Rischi: ${exp.rischi.join(', ')}`).join('\n')
      : "Negativa";

    const familyText = visitForm.anamnesi_familiare
      .filter(m => m.patologie.length > 0 || m.deceduto)
      .map(m => `${m.parentela}: ${m.patologie.join(', ') || 'Nessuna patologia'}${m.deceduto ? ' (Deceduto)' : ''}`)
      .join('\n') || "Negativa";

    const pdfVisit: Partial<PDFVisit> = {
      data_visita: visitForm.data_visita,
      tipo_visita: visitForm.tipo_visita,
      anamnesi_lavorativa: workHistoryText,
      anamnesi_familiare: familyText,
      anamnesi_patologica_remota: visitForm.anamnesi_patologica_remota,
      anamnesi_patologica_prossima: visitForm.anamnesi_patologica_prossima,
      anamnesi_fisiologica: fisioJSON,
      allergie: visitForm.anamnesi_patologica.allergie.nessuna ? 'Nessuna' : visitForm.anamnesi_patologica.allergie.dettaglio,
      vaccinazioni: visitForm.vaccinazioni,
      giudizio: visitForm.giudizio,
      prescrizioni: visitForm.prescrizioni,
      scadenza_prossima: visitForm.scadenza_prossima,
      accertamenti_effettuati: visitForm.accertamenti_effettuati,
      eo_cardiaca: visitForm.eo_cardiaca, // <!-- MODIFICA -->
      eo_respiratoria: visitForm.eo_respiratoria, // <!-- MODIFICA -->
      eo_cervicale: visitForm.eo_cervicale, // <!-- MODIFICA -->
      eo_dorsolombare: visitForm.eo_dorsolombare, // <!-- MODIFICA -->
      eo_spalle: visitForm.eo_spalle, // <!-- MODIFICA -->
      eo_arti_superiori: visitForm.eo_arti_superiori, // <!-- MODIFICA -->
      eo_arti_inferiori: visitForm.eo_arti_inferiori, // <!-- MODIFICA -->
      eo_altro: visitForm.eo_altro, // <!-- MODIFICA -->
      incidenti_invalidita: visitForm.incidenti_invalidita, // <!-- MODIFICA -->
      conclusioni: visitForm.conclusioni // <!-- MODIFICA -->
    };

    const doc = generateCompletePDF({
      mode: 'combined',
      visit: pdfVisit,
      worker: workerData as unknown as PDFWorker,
      company: companyData,
      doctor: doctorData
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
