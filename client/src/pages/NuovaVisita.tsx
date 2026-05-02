import { useState, useEffect, useMemo } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import {
  User, Clipboard, Activity, CheckCircle, Mail, RefreshCw,
  Heart, Wind, Stethoscope, Eye, Ear, Brain,
  ChevronDown, ChevronUp, Check, AlertTriangle, FileText, Send, Save, Printer, Copy, X,
  ExternalLink, FileCheck
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { fetchGmailMessages, type GmailMessage } from '../lib/gmail';
import { fetchGmailAttachments } from '../lib/attachments';
import { get, set } from 'idb-keyval';
import WorkerSearch from '../components/WorkerSearch';
import { useAppStore } from '../store/useAppStore';
import { sendEmailViaGmail } from '../lib/emailService';
import type { Visit, Worker, EmailTemplate, DoctorProfile } from '../types';
import { Link } from 'react-router-dom';

interface CollapsibleCardProps {
  title: string;
  icon: React.ReactNode;
  isNormal: boolean;
  normalText: string;
  isOpen: boolean;
  onToggle: () => void;
  onReset: () => void;
  children: React.ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title, icon, isNormal, normalText, isOpen, onToggle, onReset, children
}) => {
  return (
    <div className={`transition-all duration-300 rounded-[24px] border-2 ${
      isOpen ? 'border-amber-400 bg-white shadow-xl' : 'border-gray-100 bg-warmWhite/30'
    }`}>
      <div className="p-4 flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-xl ${isOpen ? 'bg-amber-100 text-amber-600' : 'bg-primary/5 text-primary'}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-primary/80">{title}</h3>
            {!isOpen && (
              <div className="flex items-center gap-2 mt-1">
                {isNormal ? (
                  <>
                    <Check size={12} className="text-tealAction" strokeWidth={3} />
                    <span className="text-[11px] text-gray-500 font-medium italic truncate max-w-[400px]">{normalText}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={12} className="text-amber-500" strokeWidth={3} />
                    <span className="text-[11px] text-amber-600 font-bold uppercase tracking-tight">Anomalia rilevata / Modificato (Stato Espanso)</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isOpen && (
            <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
              Modifica
            </button>
          )}
          {isOpen ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-6 pt-0 border-t border-gray-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="mt-6">
            {children}
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <button
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="px-4 py-2 text-[10px] font-black text-tealAction uppercase tracking-widest border border-tealAction/20 rounded-xl hover:bg-tealAction/5 transition-colors"
            >
              Ripristina norma
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const NuovaVisita = () => {
  const { isEmailConfigured } = useAppStore();
  const [lavoratori, setLavoratori] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  const [step, setStep] = useState(1);
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Gmail State
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Email Dialog State
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailPreview, setEmailPreview] = useState({ soggetto: '', corpo: '', workerEmail: '', companyEmail: '' });
  const [sendToWorker, setSendToWorker] = useState(true);
  const [sendToCompany, setSendToCompany] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const defaultVisitState: Partial<Visit> = {
    data_visita: new Date().toISOString().split('T')[0],
    tipo_visita: 'periodica',
    anamnesi_lavorativa: '',
    anamnesi_familiare: '',
    anamnesi_patologica: '',
    giudizio: 'idoneo',
    prescrizioni: '',
    accertamenti_effettuati: '',
    scadenza_prossima: '',

    // Antropometrici
    condizioni_generali: 'Buone',
    altezza: 170,
    peso: 70,
    bmi: 24.2,

    // Cardio
    p_sistolica: 120,
    p_diastolica: 80,
    frequenza: 70,
    eo_toni_puri: true,
    eo_toni_ritmici: true,
    eo_varici: false,

    // Digerente
    eo_addome_piano: true,
    eo_trattabile: true,
    eo_dolente: false,
    eo_fegato_regolare: true,
    eo_milza_regolare: true,

    // Urogenitale
    eo_giordano_dx: 'Negativa',
    eo_giordano_sx: 'Negativa',

    // Respiratorio
    eo_pless_norma: true,
    eo_ispettivi_norma: true,

    // Sistema Nervoso
    eo_tinel: 'Non eseguita',
    eo_phalen: 'Non eseguita',

    // Osteoarticolare
    eo_lasegue_dx: 'Negativa',
    eo_lasegue_sx: 'Negativa',
    eo_palpazione_paravertebrali: 'Nessun dolore',
    eo_digitopressione_apofisi: 'Nessun dolore',
    eo_rachide_rotazione: 'Nella norma',
    eo_rachide_inclinazione: 'Nella norma',
    eo_rachide_flessoestensione: 'Nella norma',

    // Visus/Udito
    eo_visus_nat_os: 10,
    eo_visus_nat_od: 10,
    eo_visus_corr_os: 10,
    eo_visus_corr_od: 10,
    eo_udito_ridotto: false,

    eo_note: '',
    visita_completata: false,
    allegati_count: 0
  };

  const [visitForm, setVisitForm] = useState<Partial<Visit>>(defaultVisitState);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = () => {
    const data = executeQuery(`
      SELECT workers.*, companies.ragione_sociale as azienda, companies.email as company_email
      FROM workers
      JOIN companies ON workers.company_id = companies.id
    `) as Worker[];
    setLavoratori(data);
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

        const fullWorker = fullWorkerResults[0] as (Worker & { protocol_periodicity: number });

        if (fullWorker) {
          let months = fullWorker.protocol_periodicity || 12;
          if (fullWorker.is_protocol_customized && fullWorker.custom_protocol) {
            try {
              const customExams = JSON.parse(fullWorker.custom_protocol) as { periodicita: number }[];
              if (customExams.length > 0) {
                months = Math.min(...customExams.map((e) => e.periodicita || 12));
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

  const risks = useMemo(() => {
    if (!workerData?.rischi) return [];
    try {
      return JSON.parse(workerData.rischi) as string[];
    } catch {
      return [];
    }
  }, [workerData]);

  const showNervous = risks.some(r => r.toUpperCase().includes('VDT') || r.toUpperCase().includes('SOVRACCARICO'));
  const showVisusHearing = risks.some(r => r.toUpperCase().includes('VDT') || r.toUpperCase().includes('RUMORE'));

  const bmi = useMemo(() => {
    if (visitForm.peso && visitForm.altezza) {
      const h = visitForm.altezza / 100;
      return parseFloat((visitForm.peso / (h * h)).toFixed(1));
    }
    return 0;
  }, [visitForm.peso, visitForm.altezza]);

  const saveAnthroDefaults = async () => {
    await set('default_altezza', visitForm.altezza);
    await set('default_condizioni', visitForm.condizioni_generali);
    alert("Impostazioni antropometriche salvate come default!");
  };

  useEffect(() => {
    const loadAnthroDefaults = async () => {
      const defH = await get('default_altezza') as number;
      const defC = await get('default_condizioni') as Visit['condizioni_generali'];
      if (defH || defC) {
        setVisitForm(prev => ({
          ...prev,
          altezza: defH || prev.altezza,
          condizioni_generali: defC || prev.condizioni_generali
        }));
      }
    };
    loadAnthroDefaults();
  }, []);

  useEffect(() => {
    setVisitForm(prev => ({ ...prev, bmi }));
  }, [bmi]);

  const getBMIBadge = () => {
    if (bmi === 0) return null;
    if (bmi < 25) return <span className="bg-tealAction text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-tealAction/20">Normopeso</span>;
    if (bmi < 30) return <span className="bg-amber-400 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-amber-400/20">Sovrappeso</span>;
    return <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-red-500/20">Obeso</span>;
  };

  const isCardioNormal = !!(visitForm.p_sistolica === 120 && visitForm.p_diastolica === 80 && visitForm.frequenza === 70 && visitForm.eo_toni_puri && visitForm.eo_toni_ritmici && !visitForm.eo_varici);
  const isDigerenteNormal = !!(visitForm.eo_addome_piano && visitForm.eo_trattabile && !visitForm.eo_dolente && visitForm.eo_fegato_regolare && visitForm.eo_milza_regolare);
  const isUrogenitaleNormal = visitForm.eo_giordano_dx === 'Negativa' && visitForm.eo_giordano_sx === 'Negativa';
  const isRespiratorioNormal = !!(visitForm.eo_pless_norma && visitForm.eo_ispettivi_norma);
  const isSistemaNervosoNormal = visitForm.eo_tinel === 'Non eseguita' && visitForm.eo_phalen === 'Non eseguita';
  const isOsteoarticolareNormal = visitForm.eo_lasegue_dx === 'Negativa' && visitForm.eo_lasegue_sx === 'Negativa' && visitForm.eo_palpazione_paravertebrali === 'Nessun dolore' && visitForm.eo_digitopressione_apofisi === 'Nessun dolore' && visitForm.eo_rachide_rotazione === 'Nella norma' && visitForm.eo_rachide_inclinazione === 'Nella norma' && visitForm.eo_rachide_flessoestensione === 'Nella norma';
  const isVisusHearingNormal = visitForm.eo_visus_nat_os === 10 && visitForm.eo_visus_nat_od === 10 && visitForm.eo_visus_corr_os === 10 && visitForm.eo_visus_corr_od === 10 && !visitForm.eo_udito_ridotto;

  const handleAuthAndFetch = async () => {
    const clientId = await get('google_client_id') as string;
    if (!clientId) {
      alert("Configura il Client ID nelle impostazioni prima di usare Gmail.");
      return;
    }

    setLoadingGmail(true);
    try {
      const gapi = (window as any).google;
      const client = gapi.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: async (response: { access_token: string }) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            const msgs = await fetchGmailMessages(response.access_token, workerData?.email || '');
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
      anamnesi_patologica: (prev.anamnesi_patologica || '') + (prev.anamnesi_patologica ? "\n\n" : "") + textToImport
    }));
    alert("Testo e allegati importati in Anamnesi Patologica!");
  };

  const handleSave = async () => {
    if (!selectedWorkerId) return;

    const query = `
      INSERT INTO visits (
        worker_id, data_visita, tipo_visita, anamnesi_lavorativa, anamnesi_familiare, anamnesi_patologica,
        accertamenti_effettuati, eo_note, giudizio, prescrizioni, scadenza_prossima,
        condizioni_generali, altezza, peso, bmi, p_sistolica, p_diastolica, frequenza,
        eo_toni_puri, eo_toni_ritmici, eo_varici, eo_addome_piano, eo_trattabile, eo_dolente,
        eo_fegato_regolare, eo_milza_regolare, eo_giordano_dx, eo_giordano_sx,
        eo_pless_norma, eo_ispettivi_norma, eo_tinel, eo_phalen,
        eo_lasegue_dx, eo_lasegue_sx, eo_palpazione_paravertebrali, eo_digitopressione_apofisi,
        eo_rachide_rotazione, eo_rachide_inclinazione, eo_rachide_flessoestensione,
        eo_visus_nat_os, eo_visus_nat_od, eo_visus_corr_os, eo_visus_corr_od, eo_udito_ridotto,
        visita_completata, allegati_count, trasmissione_lavoratore_data, trasmissione_lavoratore_metodo,
        trasmissione_datore_data, trasmissione_datore_metodo, finalized
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    const params = [
      selectedWorkerId, visitForm.data_visita, visitForm.tipo_visita,
      visitForm.anamnesi_lavorativa, visitForm.anamnesi_familiare, visitForm.anamnesi_patologica,
      visitForm.accertamenti_effettuati, visitForm.eo_note, visitForm.giudizio, visitForm.prescrizioni, visitForm.scadenza_prossima,
      visitForm.condizioni_generali, visitForm.altezza, visitForm.peso, visitForm.bmi,
      visitForm.p_sistolica, visitForm.p_diastolica, visitForm.frequenza,
      visitForm.eo_toni_puri ? 1 : 0, visitForm.eo_toni_ritmici ? 1 : 0, visitForm.eo_varici ? 1 : 0,
      visitForm.eo_addome_piano ? 1 : 0, visitForm.eo_trattabile ? 1 : 0, visitForm.eo_dolente ? 1 : 0,
      visitForm.eo_fegato_regolare ? 1 : 0, visitForm.eo_milza_regolare ? 1 : 0,
      visitForm.eo_giordano_dx, visitForm.eo_giordano_sx,
      visitForm.eo_pless_norma ? 1 : 0, visitForm.eo_ispettivi_norma ? 1 : 0,
      visitForm.eo_tinel, visitForm.eo_phalen,
      visitForm.eo_lasegue_dx, visitForm.eo_lasegue_sx,
      visitForm.eo_palpazione_paravertebrali, visitForm.eo_digitopressione_apofisi,
      visitForm.eo_rachide_rotazione, visitForm.eo_rachide_inclinazione, visitForm.eo_rachide_flessoestensione,
      visitForm.eo_visus_nat_os, visitForm.eo_visus_nat_od, visitForm.eo_visus_corr_os, visitForm.eo_visus_corr_od,
      visitForm.eo_udito_ridotto ? 1 : 0,
      visitForm.visita_completata ? 1 : 0, visitForm.allegati_count,
      visitForm.trasmissione_lavoratore_data, visitForm.trasmissione_lavoratore_metodo,
      visitForm.trasmissione_datore_data, visitForm.trasmissione_datore_metodo
    ];

    await runCommand(query, params);

    const lastVisitId = executeQuery("SELECT id FROM visits ORDER BY id DESC LIMIT 1")[0].id as number;
    await runCommand(
      "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
      ["FINALIZE", "visits", lastVisitId, `Visita finalizzata per lavoratore ID: ${selectedWorkerId}`]
    );

    alert("Visita salvata con successo!");

    if (isEmailConfigured && visitForm.giudizio) {
      await prepareEmail();
    } else {
      generatePDFs();
      setStep(1);
      setSelectedWorkerId('');
    }
  };

  const prepareEmail = async () => {
    const template = executeQuery("SELECT * FROM email_templates WHERE tipo = 'giudizio'")[0] as EmailTemplate;
    const senderName = await get('sender_name') as string || "Medico Competente";

    if (!template || !workerData) return;

    const corpo = template.corpo
      .replace('{nome_lavoratore}', `${workerData.nome} ${workerData.cognome}`)
      .replace('{data_visita}', visitForm.data_visita || '')
      .replace('{azienda}', workerData.azienda || '')
      .replace('{giudizio}', visitForm.giudizio?.toUpperCase() || '')
      .replace('{medico}', senderName);

    const soggetto = template.soggetto.replace('{azienda}', workerData.azienda || '');

    setEmailPreview({
      soggetto,
      corpo,
      workerEmail: workerData.email || '',
      companyEmail: workerData.company_email || ''
    });
    setShowEmailDialog(true);
  };

  const handleSendEmails = async () => {
    setIsSending(true);
    const lastVisitId = executeQuery("SELECT id FROM visits ORDER BY id DESC LIMIT 1")[0].id as number;

    // Generate the judgment PDF to be attached
    const { giudizioDoc } = generatePDFs(false);
    // Convert PDF to base64 for Gmail attachment
    const pdfBase64 = giudizioDoc.output('datauristring').split(',')[1];

    if (sendToWorker && emailPreview.workerEmail) {
      await sendEmailViaGmail(
        emailPreview.workerEmail,
        emailPreview.soggetto,
        emailPreview.corpo,
        lastVisitId,
        {
          filename: `Giudizio_${workerData?.cognome}_${visitForm.data_visita}.pdf`,
          content: pdfBase64,
          type: 'application/pdf'
        }
      );
      await runCommand(
        "UPDATE visits SET trasmissione_lavoratore_data = ?, trasmissione_lavoratore_metodo = 'Email' WHERE id = ?",
        [new Date().toISOString().split('T')[0], lastVisitId]
      );
    }

    if (sendToCompany && emailPreview.companyEmail) {
      await sendEmailViaGmail(
        emailPreview.companyEmail,
        emailPreview.soggetto,
        emailPreview.corpo,
        lastVisitId,
        {
          filename: `Giudizio_${workerData?.cognome}_${visitForm.data_visita}.pdf`,
          content: pdfBase64,
          type: 'application/pdf'
        }
      );
      await runCommand(
        "UPDATE visits SET trasmissione_datore_data = ?, trasmissione_datore_metodo = 'Email' WHERE id = ?",
        [new Date().toISOString().split('T')[0], lastVisitId]
      );
    }

    setIsSending(false);
    setShowEmailDialog(false);
    setStep(1);
    setSelectedWorkerId('');
    alert("Comunicazioni inviate e visita completata!");
  };

  const generatePDFs = (save: boolean = true) => {
    if (!workerData) return { giudizioDoc: new jsPDF(), cartellaDoc: new jsPDF() };
    const doctorDataResults = executeQuery("SELECT * FROM doctor_profile WHERE id = 1");
    const doctorData = doctorDataResults[0] as DoctorProfile || { nome: '', specializzazione: '', n_iscrizione: '' };
    const doc = new jsPDF();

    // Standard PDF Generation (Giudizio di Idoneità)
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
    doc.text(`Tipo Visita: ${visitForm.tipo_visita?.toUpperCase()}`, 20, 75);

    doc.setFont("helvetica", "bold");
    doc.text("GIUDIZIO:", 20, 90);
    doc.setFontSize(14);
    doc.text(visitForm.giudizio?.toUpperCase() || '', 45, 90);

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

    if (save) doc.save(`Giudizio_${workerData.cognome}_${visitForm.data_visita}.pdf`);

    // Extended Cartella Sanitaria (Allegato 3A)
    const cartella = new jsPDF();
    cartella.setFontSize(14);
    cartella.setFont("helvetica", "bold");
    cartella.text("CARTELLA SANITARIA E DI RISCHIO", 105, 20, { align: 'center' });
    cartella.setFontSize(10);
    cartella.text("(Allegato 3A - D.Lgs. 81/08)", 105, 26, { align: 'center' });

    cartella.text("SEZIONE 1: ANAGRAFICA", 15, 40);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Lavoratore: ${workerData.cognome} ${workerData.nome}`, 20, 47);
    cartella.text(`Azienda: ${workerData.azienda} | Mansione: ${workerData.mansione}`, 20, 53);

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 2: ANAMNESI", 15, 65);
    cartella.setFont("helvetica", "normal");
    cartella.text("Lavorativa:", 20, 72);
    cartella.text(visitForm.anamnesi_lavorativa || "Negativa", 25, 78, { maxWidth: 165 });
    cartella.text("Patologica/Familiare:", 20, 95);
    cartella.text(visitForm.anamnesi_patologica || "Negativa", 25, 101, { maxWidth: 165 });

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 3: ESAME OBIETTIVO E PARAMETRI", 15, 130);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Condizioni Generali: ${visitForm.condizioni_generali}`, 20, 137);
    cartella.text(`Peso: ${visitForm.peso}kg | Altezza: ${visitForm.altezza}cm | BMI: ${bmi}`, 20, 143);

    let currentY = 153;
    const addEOSection = (title: string, content: string) => {
      if (currentY > 260) {
        cartella.addPage();
        currentY = 20;
      }
      cartella.setFont("helvetica", "bold");
      cartella.text(title.toUpperCase(), 20, currentY);
      cartella.setFont("helvetica", "normal");
      const splitContent = cartella.splitTextToSize(content, 165);
      cartella.text(splitContent, 25, currentY + 6);
      currentY += (splitContent.length * 5) + 10;
    };

    addEOSection("Apparato Cardiovascolare", `Toni: ${visitForm.eo_toni_puri ? 'puri' : 'impuri'}, ${visitForm.eo_toni_ritmici ? 'ritmici' : 'aritmici'}. Varici: ${visitForm.eo_varici ? 'Presenti' : 'Assenti'}. Pressione Arteriosa: ${visitForm.p_sistolica}/${visitForm.p_diastolica} mmHg. Frequenza Cardiaca: ${visitForm.frequenza} bpm.`);
    addEOSection("Apparato Digerente", `Addome: ${visitForm.eo_addome_piano ? 'piano' : 'globoso'}, ${visitForm.eo_trattabile ? 'trattabile' : 'non trattabile'}, ${visitForm.eo_dolente ? 'dolente' : 'non dolente'}. Fegato: ${visitForm.eo_fegato_regolare ? 'regolare' : 'non regolare'}. Milza: ${visitForm.eo_milza_regolare ? 'regolare' : 'non regolare'}.`);
    addEOSection("Apparato Urogenitale", `Giordano: Destro ${visitForm.eo_giordano_dx}, Sinistro ${visitForm.eo_giordano_sx}.`);
    addEOSection("Apparato Respiratorio", `Plessoacustici: ${visitForm.eo_pless_norma ? 'nella norma' : 'alterati'}. Ispettivi: ${visitForm.eo_ispettivi_norma ? 'nella norma' : 'alterati'}.`);
    addEOSection("Sistema Nervoso", `Test di Tinel: ${visitForm.eo_tinel}. Test di Phalen: ${visitForm.eo_phalen}.`);
    addEOSection("Apparato Osteoarticolare", `Lasègue: Destro ${visitForm.eo_lasegue_dx}, Sinistro ${visitForm.eo_lasegue_sx}. Palpazione paravertebrali: ${visitForm.eo_palpazione_paravertebrali}. Digitopressione apofisi: ${visitForm.eo_digitopressione_apofisi}. Mobilità rachide: Rotazione ${visitForm.eo_rachide_rotazione}, Inclinazione ${visitForm.eo_rachide_inclinazione}, Flessoestensione ${visitForm.eo_rachide_flessoestensione}.`);
    addEOSection("Visus e Udito", `Visus OS: Naturale ${visitForm.eo_visus_nat_os}/10, Corretto ${visitForm.eo_visus_corr_os}/10. Visus OD: Naturale ${visitForm.eo_visus_nat_od}/10, Corretto ${visitForm.eo_visus_corr_od}/10. Udito ridotto: ${visitForm.eo_udito_ridotto ? 'Sì' : 'No'}.`);

    if (visitForm.eo_note) {
      addEOSection("Note Esame Obiettivo", visitForm.eo_note);
    }

    if (visitForm.accertamenti_effettuati) {
       addEOSection("Accertamenti Strumentali", visitForm.accertamenti_effettuati);
    }

    if (save) cartella.save(`Cartella_3A_${workerData.cognome}_${visitForm.data_visita}.pdf`);

    return { giudizioDoc: doc, cartellaDoc: cartella };
  };

  return (
    <div className="p-10 max-w-5xl mx-auto font-['DM_Sans']">
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

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-amber-600 font-black flex items-center gap-2 text-sm uppercase tracking-tight">
                  <Mail size={18} /> Acquisizione Gmail
                </h3>
                <button onClick={handleAuthAndFetch} disabled={loadingGmail} className="btn-accent flex items-center gap-2 text-xs py-2 px-4">
                  {loadingGmail ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />} Sincronizza
                </button>
              </div>
              {gmailMessages.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {gmailMessages.map(msg => (
                    <div key={msg.id} className="bg-white/80 p-3 rounded-xl border border-amber-500/10 text-[10px] flex justify-between items-center gap-4">
                      <div className="flex-1 font-bold">[{msg.date}] {msg.snippet}</div>
                      <button onClick={() => importEmailText(msg)} className="text-amber-600 hover:underline font-black uppercase tracking-tighter shrink-0">Importa</button>
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

            {/* Dati Antropometrici */}
            <div className="bg-white p-8 rounded-[32px] border-2 border-gray-50 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary/40">Dati Antropometrici</h3>
                <button
                  onClick={saveAnthroDefaults}
                  className="text-[9px] font-black text-amber-500 uppercase tracking-widest hover:underline"
                >
                  Imposta come default
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Condizioni Generali</label>
                  <div className="flex gap-1 p-1 bg-warmWhite/50 rounded-2xl border border-gray-100">
                    {['Buone', 'Discrete', 'Scadenti'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setVisitForm({ ...visitForm, condizioni_generali: opt as Visit['condizioni_generali'] })}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${
                          visitForm.condizioni_generali === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-primary/40 hover:bg-white'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Altezza (cm)</label>
                  <div className="relative">
                    <input
                      type="number"
                      className="input-standard font-black pr-12"
                      value={visitForm.altezza}
                      onChange={e => setVisitForm({...visitForm, altezza: parseInt(e.target.value)})}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">CM</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Peso (kg)</label>
                  <div className="relative">
                    <input
                      type="number"
                      className="input-standard font-black pr-12"
                      value={visitForm.peso}
                      onChange={e => setVisitForm({...visitForm, peso: parseFloat(e.target.value)})}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">KG</span>
                  </div>
                </div>

                <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 flex flex-col items-center justify-center gap-2 h-[54px]">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-primary">IMC: {bmi}</span>
                    {getBMIBadge()}
                  </div>
                </div>
              </div>
            </div>

            {/* EO Sections - Pattern Collapse-to-Normal */}
            <div className="space-y-4">
              {/* Cardiovascolare */}
              <CollapsibleCard
                title="Cardiovascolare"
                icon={<Heart size={18} />}
                isNormal={isCardioNormal}
                normalText="Toni puri e ritmici, PA e FC nella norma, no varici"
                isOpen={openSection === 'cardio'}
                onToggle={() => setOpenSection(openSection === 'cardio' ? null : 'cardio')}
                onReset={() => setVisitForm({ ...visitForm, p_sistolica: 120, p_diastolica: 80, frequenza: 70, eo_toni_puri: true, eo_toni_ritmici: true, eo_varici: false })}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PA (Sistolica/Diastolica)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-standard w-20 text-center font-black" value={visitForm.p_sistolica} onChange={e => setVisitForm({...visitForm, p_sistolica: parseInt(e.target.value)})} />
                      <span className="text-gray-300">/</span>
                      <input type="number" className="input-standard w-20 text-center font-black" value={visitForm.p_diastolica} onChange={e => setVisitForm({...visitForm, p_diastolica: parseInt(e.target.value)})} />
                      <span className="text-[10px] font-bold text-gray-300 ml-2">mmHg</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">FC (bpm)</label>
                    <input type="number" className="input-standard w-32 font-black" value={visitForm.frequenza} onChange={e => setVisitForm({...visitForm, frequenza: parseInt(e.target.value)})} />
                  </div>
                  <div className="flex flex-wrap gap-4 items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={!!visitForm.eo_toni_puri} onChange={e => setVisitForm({...visitForm, eo_toni_puri: e.target.checked})} className="hidden" />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${visitForm.eo_toni_puri ? 'bg-tealAction border-tealAction' : 'border-gray-200 bg-white'}`}>
                        {visitForm.eo_toni_puri && <Check size={14} className="text-white" strokeWidth={4} />}
                      </div>
                      <span className="text-xs font-bold text-primary/70">Toni puri</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={!!visitForm.eo_toni_ritmici} onChange={e => setVisitForm({...visitForm, eo_toni_ritmici: e.target.checked})} className="hidden" />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${visitForm.eo_toni_ritmici ? 'bg-tealAction border-tealAction' : 'border-gray-200 bg-white'}`}>
                        {visitForm.eo_toni_ritmici && <Check size={14} className="text-white" strokeWidth={4} />}
                      </div>
                      <span className="text-xs font-bold text-primary/70">Toni ritmici</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={!!visitForm.eo_varici} onChange={e => setVisitForm({...visitForm, eo_varici: e.target.checked})} className="hidden" />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${visitForm.eo_varici ? 'bg-amber-500 border-amber-500' : 'border-gray-200 bg-white'}`}>
                        {visitForm.eo_varici && <Check size={14} className="text-white" strokeWidth={4} />}
                      </div>
                      <span className="text-xs font-bold text-primary/70">Varici venose</span>
                    </label>
                  </div>
                </div>
              </CollapsibleCard>

              {/* Digerente */}
              <CollapsibleCard
                title="Digerente"
                icon={<Activity size={18} />}
                isNormal={isDigerenteNormal}
                normalText="Addome piano, trattabile, non dolente, fegato e milza regolari"
                isOpen={openSection === 'digerente'}
                onToggle={() => setOpenSection(openSection === 'digerente' ? null : 'digerente')}
                onReset={() => setVisitForm({ ...visitForm, eo_addome_piano: true, eo_trattabile: true, eo_dolente: false, eo_fegato_regolare: true, eo_milza_regolare: true })}
              >
                <div className="flex flex-wrap gap-6">
                  {[
                    { id: 'eo_addome_piano' as keyof Visit, label: 'Addome piano' },
                    { id: 'eo_trattabile' as keyof Visit, label: 'Trattabile' },
                    { id: 'eo_dolente' as keyof Visit, label: 'Dolente', warning: true },
                    { id: 'eo_fegato_regolare' as keyof Visit, label: 'Fegato regolare' },
                    { id: 'eo_milza_regolare' as keyof Visit, label: 'Milza regolare' }
                  ].map(f => (
                    <label key={f.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!visitForm[f.id]} onChange={e => setVisitForm({...visitForm, [f.id]: e.target.checked})} className="hidden" />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${visitForm[f.id] ? (f.warning ? 'bg-amber-500 border-amber-500' : 'bg-tealAction border-tealAction') : 'border-gray-200 bg-white'}`}>
                        {visitForm[f.id] && <Check size={14} className="text-white" strokeWidth={4} />}
                      </div>
                      <span className="text-xs font-bold text-primary/70">{f.label}</span>
                    </label>
                  ))}
                </div>
              </CollapsibleCard>

              {/* Urogenitale */}
              <CollapsibleCard
                title="Urogenitale"
                icon={<Stethoscope size={18} />}
                isNormal={isUrogenitaleNormal}
                normalText="Giordano negativo bilateralmente"
                isOpen={openSection === 'urogenitale'}
                onToggle={() => setOpenSection(openSection === 'urogenitale' ? null : 'urogenitale')}
                onReset={() => setVisitForm({ ...visitForm, eo_giordano_dx: 'Negativa', eo_giordano_sx: 'Negativa' })}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Giordano DX</label>
                    <div className="flex gap-1 p-1 bg-warmWhite/50 rounded-2xl border border-gray-100">
                      {(['Negativa', 'Positiva'] as Visit['eo_giordano_dx'][]).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setVisitForm({ ...visitForm, eo_giordano_dx: opt })}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${
                            visitForm.eo_giordano_dx === opt ? (opt === 'Positiva' ? 'bg-amber-500 text-white shadow-lg' : 'bg-primary text-white shadow-lg') : 'text-primary/40 hover:bg-white'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Giordano SX</label>
                    <div className="flex gap-1 p-1 bg-warmWhite/50 rounded-2xl border border-gray-100">
                      {(['Negativa', 'Positiva'] as Visit['eo_giordano_sx'][]).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setVisitForm({ ...visitForm, eo_giordano_sx: opt })}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${
                            visitForm.eo_giordano_sx === opt ? (opt === 'Positiva' ? 'bg-amber-500 text-white shadow-lg' : 'bg-primary text-white shadow-lg') : 'text-primary/40 hover:bg-white'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleCard>

              {/* Respiratorio */}
              <CollapsibleCard
                title="Respiratorio"
                icon={<Wind size={18} />}
                isNormal={isRespiratorioNormal}
                normalText="Plessoacustici e ispettivi nella norma"
                isOpen={openSection === 'respiratorio'}
                onToggle={() => setOpenSection(openSection === 'respiratorio' ? null : 'respiratorio')}
                onReset={() => setVisitForm({ ...visitForm, eo_pless_norma: true, eo_ispettivi_norma: true })}
              >
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!visitForm.eo_pless_norma} onChange={e => setVisitForm({...visitForm, eo_pless_norma: e.target.checked})} className="hidden" />
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${visitForm.eo_pless_norma ? 'bg-tealAction border-tealAction' : 'border-gray-200 bg-white'}`}>
                      {visitForm.eo_pless_norma && <Check size={14} className="text-white" strokeWidth={4} />}
                    </div>
                    <span className="text-xs font-bold text-primary/70">Plessoacustici nella norma</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!visitForm.eo_ispettivi_norma} onChange={e => setVisitForm({...visitForm, eo_ispettivi_norma: e.target.checked})} className="hidden" />
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${visitForm.eo_ispettivi_norma ? 'bg-tealAction border-tealAction' : 'border-gray-200 bg-white'}`}>
                      {visitForm.eo_ispettivi_norma && <Check size={14} className="text-white" strokeWidth={4} />}
                    </div>
                    <span className="text-xs font-bold text-primary/70">Ispettivi nella norma</span>
                  </label>
                </div>
              </CollapsibleCard>

              {/* Sistema Nervoso (Conditional) */}
              {showNervous && (
                <CollapsibleCard
                  title="Sistema Nervoso"
                  icon={<Brain size={18} />}
                  isNormal={isSistemaNervosoNormal}
                  normalText="Tinel e Phalen non eseguiti"
                  isOpen={openSection === 'nervoso'}
                  onToggle={() => setOpenSection(openSection === 'nervoso' ? null : 'nervoso')}
                  onReset={() => setVisitForm({ ...visitForm, eo_tinel: 'Non eseguita', eo_phalen: 'Non eseguita' })}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Test di Tinel</label>
                      <div className="flex gap-1 p-1 bg-warmWhite/50 rounded-2xl border border-gray-100">
                        {(['Non eseguita', 'Negativa', 'Positiva'] as Visit['eo_tinel'][]).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisitForm({ ...visitForm, eo_tinel: opt })}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${
                              visitForm.eo_tinel === opt ? (opt === 'Positiva' ? 'bg-amber-500 text-white shadow-lg' : 'bg-primary text-white shadow-lg') : 'text-primary/40 hover:bg-white'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Test di Phalen</label>
                      <div className="flex gap-1 p-1 bg-warmWhite/50 rounded-2xl border border-gray-100">
                        {(['Non eseguita', 'Negativa', 'Positiva'] as Visit['eo_phalen'][]).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisitForm({ ...visitForm, eo_phalen: opt })}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${
                              visitForm.eo_phalen === opt ? (opt === 'Positiva' ? 'bg-amber-500 text-white shadow-lg' : 'bg-primary text-white shadow-lg') : 'text-primary/40 hover:bg-white'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CollapsibleCard>
              )}

              {/* Osteoarticolare */}
              <CollapsibleCard
                title="Osteoarticolare"
                icon={<Stethoscope size={18} />}
                isNormal={isOsteoarticolareNormal}
                normalText="Lasègue negativo bilat., rachide mobile, paravertebrali non dolorabili"
                isOpen={openSection === 'osteo'}
                onToggle={() => setOpenSection(openSection === 'osteo' ? null : 'osteo')}
                onReset={() => setVisitForm({
                  ...visitForm,
                  eo_lasegue_dx: 'Negativa',
                  eo_lasegue_sx: 'Negativa',
                  eo_palpazione_paravertebrali: 'Nessun dolore',
                  eo_digitopressione_apofisi: 'Nessun dolore',
                  eo_rachide_rotazione: 'Nella norma',
                  eo_rachide_inclinazione: 'Nella norma',
                  eo_rachide_flessoestensione: 'Nella norma'
                })}
              >
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lasègue DX</label>
                      <div className="flex gap-1 p-1 bg-warmWhite/50 rounded-2xl border border-gray-100">
                        {(['Negativa', 'Positiva'] as Visit['eo_lasegue_dx'][]).map((opt) => (
                          <button key={opt} onClick={() => setVisitForm({ ...visitForm, eo_lasegue_dx: opt })} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${visitForm.eo_lasegue_dx === opt ? (opt === 'Positiva' ? 'bg-amber-500 text-white shadow-lg' : 'bg-primary text-white shadow-lg') : 'text-primary/40 hover:bg-white'}`}>{opt}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lasègue SX</label>
                      <div className="flex gap-1 p-1 bg-warmWhite/50 rounded-2xl border border-gray-100">
                        {(['Negativa', 'Positiva'] as Visit['eo_lasegue_sx'][]).map((opt) => (
                          <button key={opt} onClick={() => setVisitForm({ ...visitForm, eo_lasegue_sx: opt })} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${visitForm.eo_lasegue_sx === opt ? (opt === 'Positiva' ? 'bg-amber-500 text-white shadow-lg' : 'bg-primary text-white shadow-lg') : 'text-primary/40 hover:bg-white'}`}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Palpazione Paravertebrali</label>
                      <div className="flex gap-1 p-1 bg-warmWhite/50 rounded-2xl border border-gray-100">
                        {(['Nessun dolore', 'Dolorabile', 'Dolente'] as Visit['eo_palpazione_paravertebrali'][]).map((opt) => (
                          <button key={opt} onClick={() => setVisitForm({ ...visitForm, eo_palpazione_paravertebrali: opt })} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${visitForm.eo_palpazione_paravertebrali === opt ? (opt === 'Nessun dolore' ? 'bg-primary text-white shadow-lg' : 'bg-amber-500 text-white shadow-lg') : 'text-primary/40 hover:bg-white'}`}>{opt}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Digitopressione Apofisi</label>
                      <div className="flex gap-1 p-1 bg-warmWhite/50 rounded-2xl border border-gray-100">
                        {(['Nessun dolore', 'Dolorabile', 'Dolente'] as Visit['eo_digitopressione_apofisi'][]).map((opt) => (
                          <button key={opt} onClick={() => setVisitForm({ ...visitForm, eo_digitopressione_apofisi: opt })} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${visitForm.eo_digitopressione_apofisi === opt ? (opt === 'Nessun dolore' ? 'bg-primary text-white shadow-lg' : 'bg-amber-500 text-white shadow-lg') : 'text-primary/40 hover:bg-white'}`}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mobilità Rachide</label>
                    <div className="grid grid-cols-1 gap-4">
                      {(['Rotazione', 'Inclinazione', 'Flessoestensione'] as const).map((axis) => {
                        const fieldName = `eo_rachide_${axis.toLowerCase()}` as keyof Visit;
                        return (
                          <div key={axis} className="flex items-center justify-between bg-warmWhite/30 p-3 rounded-2xl border border-gray-100">
                            <span className="text-xs font-bold text-primary/60 ml-2">{axis}</span>
                            <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm">
                              {(['Nella norma', 'Lievemente ridotta', 'Ridotta'] as const).map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => setVisitForm({ ...visitForm, [fieldName]: opt })}
                                  className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-tighter rounded-lg transition-all ${visitForm[fieldName] === opt ? 'bg-primary text-white' : 'text-primary/40 hover:bg-primary/5'}`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CollapsibleCard>

              {/* Visus e Udito (Conditional) */}
              {showVisusHearing && (
                <CollapsibleCard
                  title="Visus e Udito"
                  icon={<Eye size={18} />}
                  isNormal={isVisusHearingNormal}
                  normalText="Visus nella norma, udito non ridotto"
                  isOpen={openSection === 'visus'}
                  onToggle={() => setOpenSection(openSection === 'visus' ? null : 'visus')}
                  onReset={() => setVisitForm({ ...visitForm, eo_visus_nat_os: 10, eo_visus_nat_od: 10, eo_visus_corr_os: 10, eo_visus_corr_od: 10, eo_udito_ridotto: false })}
                >
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-primary/40 uppercase tracking-widest border-b border-gray-50 pb-2">Occhio Sinistro (OS)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Naturale</span>
                            <input type="number" className="input-standard font-black" value={visitForm.eo_visus_nat_os} onChange={e => setVisitForm({...visitForm, eo_visus_nat_os: parseFloat(e.target.value)})} />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Corretto</span>
                            <input type="number" className="input-standard font-black" value={visitForm.eo_visus_corr_os} onChange={e => setVisitForm({...visitForm, eo_visus_corr_os: parseFloat(e.target.value)})} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-primary/40 uppercase tracking-widest border-b border-gray-50 pb-2">Occhio Destro (OD)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Naturale</span>
                            <input type="number" className="input-standard font-black" value={visitForm.eo_visus_nat_od} onChange={e => setVisitForm({...visitForm, eo_visus_nat_od: parseFloat(e.target.value)})} />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Corretto</span>
                            <input type="number" className="input-standard font-black" value={visitForm.eo_visus_corr_od} onChange={e => setVisitForm({...visitForm, eo_visus_corr_od: parseFloat(e.target.value)})} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-50">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" checked={!!visitForm.eo_udito_ridotto} onChange={e => setVisitForm({...visitForm, eo_udito_ridotto: e.target.checked})} className="hidden" />
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${visitForm.eo_udito_ridotto ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/20' : 'border-gray-200 bg-white group-hover:border-primary/20'}`}>
                          {visitForm.eo_udito_ridotto && <Check size={16} className="text-white" strokeWidth={4} />}
                        </div>
                        <div className="flex items-center gap-2">
                          <Ear size={16} className={visitForm.eo_udito_ridotto ? 'text-amber-600' : 'text-gray-400'} />
                          <span className={`text-xs font-black uppercase tracking-tight ${visitForm.eo_udito_ridotto ? 'text-amber-600' : 'text-primary/60'}`}>Udito ridotto</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </CollapsibleCard>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary/40">
                <FileText size={16} />
                <label className="text-[10px] font-black uppercase tracking-widest">Note Esame Obiettivo (Opzionale)</label>
              </div>
              <textarea
                className="input-standard h-24 text-sm"
                placeholder="Note cliniche aggiuntive..."
                value={visitForm.eo_note}
                onChange={e => setVisitForm({...visitForm, eo_note: e.target.value})}
              />
            </div>

            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(2)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Indietro</button>
              <button onClick={() => setStep(4)} className="btn-teal px-12 py-4">Vai al Giudizio</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-accent/5 rounded-2xl text-accent"><CheckCircle size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Giudizio Finale</h2>
            </div>

            {/* Banner for Email Configuration */}
            {!isEmailConfigured && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-[32px] p-8 flex items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-amber-100 rounded-2xl text-amber-600"><AlertTriangle size={32} /></div>
                  <div>
                    <h3 className="text-amber-900 font-black uppercase tracking-tight">Invio giudizio disattivato</h3>
                    <p className="text-amber-800 text-sm font-medium mt-1">Configura l'email nelle impostazioni per inviare il giudizio automaticamente a lavoratore e datore.</p>
                  </div>
                </div>
                <Link to="/settings" className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-700 transition-all flex items-center gap-3 shadow-lg shadow-amber-600/20">
                  Vai alle Impostazioni <ExternalLink size={18} />
                </Link>
              </div>
            )}

            <div className="bg-accent/5 p-8 rounded-[40px] border border-accent/10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

              {/* Footer Visita */}
              <div className="pt-10 border-t border-accent/10">
                <div className="bg-white/50 p-6 rounded-[32px] border border-accent/5">
                   <div className="flex flex-wrap items-center justify-between gap-6">
                      <div className="flex items-center gap-6">
                         <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={!!visitForm.visita_completata} onChange={e => setVisitForm({...visitForm, visita_completata: e.target.checked})} className="hidden" />
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${visitForm.visita_completata ? 'bg-tealAction border-tealAction shadow-lg' : 'border-gray-200 bg-white'}`}>
                              {visitForm.visita_completata && <Check size={16} className="text-white" strokeWidth={4} />}
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-tight text-primary/80">Visita completata</span>
                         </label>

                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Allegati</span>
                            <input type="number" className="w-16 bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs font-black text-primary outline-none" value={visitForm.allegati_count} onChange={e => setVisitForm({...visitForm, allegati_count: parseInt(e.target.value)})} />
                         </div>
                      </div>

                      <div className="flex items-center gap-6 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                         <div className="flex items-center gap-3 bg-warmWhite/80 px-4 py-2 rounded-2xl border border-gray-50">
                            <Send size={14} className="text-primary/40" />
                            <span>Lavoratore:</span>
                            <input type="date" className="bg-transparent text-primary font-black outline-none" value={visitForm.trasmissione_lavoratore_data} onChange={e => setVisitForm({...visitForm, trasmissione_lavoratore_data: e.target.value})} />
                            <span>via</span>
                            <select className="bg-transparent text-primary font-black outline-none" value={visitForm.trasmissione_lavoratore_metodo} onChange={e => setVisitForm({...visitForm, trasmissione_lavoratore_metodo: e.target.value})}>
                               <option value="Email">Email</option>
                               <option value="Cartaceo">Cartaceo</option>
                               <option value="App">App</option>
                            </select>
                         </div>
                         <div className="flex items-center gap-3 bg-warmWhite/80 px-4 py-2 rounded-2xl border border-gray-100">
                            <Send size={14} className="text-primary/40" />
                            <span>Datore:</span>
                            <input type="date" className="bg-transparent text-primary font-black outline-none" value={visitForm.trasmissione_datore_data} onChange={e => setVisitForm({...visitForm, trasmissione_datore_data: e.target.value})} />
                            <span>via</span>
                            <select className="bg-transparent text-primary font-black outline-none" value={visitForm.trasmissione_datore_metodo} onChange={e => setVisitForm({...visitForm, trasmissione_datore_metodo: e.target.value})}>
                               <option value="PEC">PEC</option>
                               <option value="Email">Email</option>
                               <option value="Cartaceo">Cartaceo</option>
                            </select>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(3)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Indietro</button>

              <div className="flex items-center gap-3">
                <button onClick={() => alert("Visita duplicata.")} className="p-4 text-primary/40 hover:text-primary transition-colors" title="Duplica Visita"><Copy size={20} /></button>
                <button onClick={() => { setStep(1); setSelectedWorkerId(''); }} className="p-4 text-red-400 hover:text-red-500 transition-colors" title="Annulla"><X size={20} /></button>
                <button onClick={() => generatePDFs()} className="flex items-center gap-2 px-6 py-4 border-2 border-primary/10 rounded-2xl text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/5 transition-all">
                  <Printer size={18} /> Stampa PDF
                </button>
                <button onClick={handleSave} className="btn-accent px-10 py-4 flex items-center gap-3 shadow-2xl shadow-accent/20">
                  <Save size={20} strokeWidth={3} /> Salva Visita
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Send Dialog */}
      {showEmailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-primary/20 backdrop-blur-md">
           <div className="bg-white rounded-[40px] max-w-2xl w-full p-10 shadow-2xl border-2 border-primary/5 animate-in zoom-in duration-300">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-tealAction/10 rounded-2xl text-tealAction"><Mail size={32} /></div>
                <div>
                  <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Invio Giudizio Idoneità</h2>
                  <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">Anteprima Comunicazione Digitale</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-warmWhite/50 p-6 rounded-3xl border border-gray-100 space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-20">Oggetto:</span>
                    <span className="text-sm font-black text-primary">{emailPreview.soggetto}</span>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Corpo Messaggio:</span>
                    <div className="text-sm font-medium text-gray-600 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-gray-100 max-h-48 overflow-y-auto">
                      {emailPreview.corpo}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-tealAction bg-tealAction/5 p-3 rounded-xl border border-tealAction/10">
                    <FileCheck size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Documento allegato: Giudizio_Idoneità.pdf</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${sendToWorker ? 'border-primary bg-primary/5 shadow-lg' : 'border-gray-100 hover:border-primary/20'}`}>
                    <input type="checkbox" className="hidden" checked={sendToWorker} onChange={e => setSendToWorker(e.target.checked)} />
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${sendToWorker ? 'bg-primary border-primary' : 'border-gray-200'}`}>
                      {sendToWorker && <Check size={16} className="text-white" strokeWidth={4} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-tight text-primary">Invia al Lavoratore</span>
                      <span className="text-[9px] font-bold text-gray-400 truncate w-40">{emailPreview.workerEmail}</span>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${sendToCompany ? 'border-primary bg-primary/5 shadow-lg' : 'border-gray-100 hover:border-primary/20'}`}>
                    <input type="checkbox" className="hidden" checked={sendToCompany} onChange={e => setSendToCompany(e.target.checked)} />
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${sendToCompany ? 'bg-primary border-primary' : 'border-gray-200'}`}>
                      {sendToCompany && <Check size={16} className="text-white" strokeWidth={4} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-tight text-primary">Invia al Datore</span>
                      <span className="text-[9px] font-bold text-gray-400 truncate w-40">{emailPreview.companyEmail}</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button
                  onClick={() => { setShowEmailDialog(false); generatePDFs(); setStep(1); setSelectedWorkerId(''); }}
                  className="flex-1 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors"
                >
                  Solo Stampa (Salta Invio)
                </button>
                <button
                  disabled={isSending || (!sendToWorker && !sendToCompany)}
                  onClick={handleSendEmails}
                  className="flex-[2] btn-accent py-5 flex items-center justify-center gap-3 shadow-2xl shadow-accent/20"
                >
                  {isSending ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                  {isSending ? 'Invio in corso...' : 'Invia e Finalizza'}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default NuovaVisita;
