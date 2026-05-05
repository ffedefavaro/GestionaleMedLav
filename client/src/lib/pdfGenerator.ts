import { jsPDF } from 'jspdf';
import { executeQuery } from './db';

// Inline Types to ensure self-contained module
export interface Company {
  id: number;
  ragione_sociale: string;
  p_iva?: string;
  codice_fiscale?: string;
  ateco?: string;
  sede_legale?: string;
  sede_operativa?: string;
  referente?: string;
  rspp?: string;
  rls?: string;
  email?: string;
}

export interface Worker {
  id: number;
  company_id: number;
  nome: string;
  cognome: string;
  codice_fiscale: string;
  email?: string;
  data_nascita: string;
  luogo_nascita?: string;
  sesso?: string;
  mansione?: string;
  data_assunzione?: string;
  rischi?: string; // JSON string
  protocol_id?: number;
  is_protocol_customized?: boolean;
  custom_protocol?: string;
  protocol_override_reason?: string;
  azienda?: string;
  company_email?: string;
}

export interface FamilyMemberHistory {
  deceduto: boolean;
  patologie: string[];
}

export interface FamilyHistory {
  padre: FamilyMemberHistory;
  madre: FamilyMemberHistory;
  fratelli_sorelle: FamilyMemberHistory;
  nonni: FamilyMemberHistory;
}

export interface PhysiologicalHistory {
  fumo: string;
  alcol: string;
  farmaci_abituali: string;
  servizio_leva: string;
  attivita_fisica?: string;
  dieta?: string;
  sonno?: string;
}

export interface WorkExperience {
  azienda: string;
  mansione: string;
  dal: string;
  al: string;
  esposizioni: string[];
}

export interface WorkHistory {
  esperienze: WorkExperience[];
}

export interface Visit {
  id: number;
  worker_id: number;
  data_visita: string;
  tipo_visita: string;
  anamnesi_lavorativa?: string;
  anamnesi_familiare?: string;
  anamnesi_patologica_remota?: string;
  anamnesi_patologica_prossima?: string;
  anamnesi_fisiologica?: string;
  allergie?: string;
  vaccinazioni?: string;
  giudizio?: string;
  prescrizioni?: string;
  scadenza_prossima?: string;
  accertamenti_effettuati?: string;
  eo_cardiaca?: string; // <!-- MODIFICA -->
  eo_respiratoria?: string; // <!-- MODIFICA -->
  eo_cervicale?: string; // <!-- MODIFICA -->
  eo_dorsolombare?: string; // <!-- MODIFICA -->
  eo_spalle?: string; // <!-- MODIFICA -->
  eo_arti_superiori?: string; // <!-- MODIFICA -->
  eo_arti_inferiori?: string; // <!-- MODIFICA -->
  eo_altro?: string; // <!-- MODIFICA -->
  incidenti_invalidita?: string; // <!-- MODIFICA -->
  conclusioni?: string; // <!-- MODIFICA -->
}

export interface DoctorProfile {
  id: number;
  nome: string;
  specializzazione: string;
  n_iscrizione: string;
  timbro_immagine?: string;
}

export interface PDFParams {
  mode: 'full' | 'judgment' | 'combined';
  visit: Partial<Visit>;
  worker: Worker;
  company: Company;
  doctor: DoctorProfile;
  // Optional legacy fields for compatibility
  workHistory?: any;
  familyHistory?: any;
  physioHistory?: any;
  risks?: string[];
}

const formatAccertamenti = (val: any): string => {
  if (!val || val === "Nulla da segnalare" || val === "Come da protocollo") return val;
  try {
    const arr = JSON.parse(val);
    if (Array.isArray(arr)) {
      return arr.map((a: any) => `${a.nome}${a.costo !== null ? ` (€ ${a.costo.toFixed(2)})` : ''}`).join(", ");
    }
  } catch (e) {}
  return val;
};

export const generateCompletePDF = (params: PDFParams): jsPDF => {
  const { mode, visit, worker, company, doctor } = params;

  // Header medico da doctor_profile if empty
  let effectiveDoctor = { ...doctor };
  if (!effectiveDoctor.nome || String(effectiveDoctor.nome).trim() === "") {
    const dbDoctor = executeQuery("SELECT * FROM doctor_profile WHERE id = 1");
    if (dbDoctor && dbDoctor.length > 0) {
      effectiveDoctor = dbDoctor[0] as DoctorProfile;
    }
  }

  // Mansione: leggi da protocollo se null
  let effectiveMansione: string = worker.mansione || "";
  if (!effectiveMansione || String(effectiveMansione).toLowerCase() === "null" || String(effectiveMansione).trim() === "") {
    if (worker.protocol_id) {
      const proto = executeQuery("SELECT mansione FROM protocols WHERE id = ?", [worker.protocol_id]);
      if (proto && proto.length > 0 && proto[0].mansione) {
        effectiveMansione = String(proto[0].mansione);
      }
    }
  }
  if (!effectiveMansione || String(effectiveMansione).toLowerCase() === "null") effectiveMansione = "Nulla da segnalare";

  const formatValue = (val: any): string => {
    if (val === null || val === undefined || String(val).trim() === "" || String(val).toLowerCase() === "null") {
      return "Nulla da segnalare";
    }
    return String(val);
  };

  const formatDate = (dateStr: any): string => {
    if (!dateStr || String(dateStr).trim() === "" || String(dateStr).toLowerCase() === "null") return "N.D.";
    const d = String(dateStr);
    const parts = d.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
  };

  const doc = new jsPDF();
  let currentY = 40;

  const addHeader = (pdf: jsPDF): void => {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    const drName = effectiveDoctor.nome || "Medico Competente";
    const drSpec = effectiveDoctor.specializzazione || "";
    const drIscr = effectiveDoctor.n_iscrizione || "";

    pdf.text(`Dott. ${drName}`, 15, 15);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${drSpec} - Iscr. Ordine ${drIscr}`, 15, 20);
    pdf.line(15, 22, 195, 22);
  };

  const addFooter = (pdf: jsPDF, pageNum: number, totalPages: number): void => {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    const drName = effectiveDoctor.nome || "Medico";
    const visitId = visit.id || "N/A";
    pdf.text(`Dr. ${drName} | Visita N.${visitId} | Pag.${pageNum} di ${totalPages}`, 105, 285, { align: 'center' });
  };

  const addSectionTitle = (pdf: jsPDF, title: string, y: number): number => {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(240, 240, 240);
    pdf.rect(15, y, 180, 7, 'F');
    pdf.text(title.toUpperCase(), 20, y + 5);
    return y + 12;
  };

  const addField = (pdf: jsPDF, label: string, value: any, y: number): number => {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${label}:`, 20, y);
    pdf.setFont("helvetica", "normal");
    const text = formatValue(value);
    const lines = pdf.splitTextToSize(text, 130);
    pdf.text(lines, 65, y);
    return y + (lines.length * 5) + 1;
  };

  const renderPage1 = (pdf: jsPDF) => {
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("CARTELLA SANITARIA E DI RISCHIO", 105, 32, { align: 'center' });

    currentY = 40;
    currentY = addSectionTitle(pdf, "1. DATI VISITA", currentY);
    currentY = addField(pdf, "Data Visita", visit.data_visita, currentY);
    currentY = addField(pdf, "Tipo Visita", visit.tipo_visita?.toUpperCase(), currentY);

    currentY = addSectionTitle(pdf, "2. DATI AZIENDA", currentY);
    currentY = addField(pdf, "Ragione Sociale", company.ragione_sociale, currentY);
    currentY = addField(pdf, "Sede Legale", company.sede_legale, currentY);
    currentY = addField(pdf, "Attività (ATECO)", company.ateco, currentY);

    currentY = addSectionTitle(pdf, "3. ANAGRAFICA LAVORATORE", currentY);
    currentY = addField(pdf, "Nominativo", `${worker.cognome} ${worker.nome}`, currentY);
    currentY = addField(pdf, "Codice Fiscale", worker.codice_fiscale, currentY);
    currentY = addField(pdf, "Data di Nascita", formatDate(worker.data_nascita), currentY);
    currentY = addField(pdf, "Sesso", worker.sesso, currentY);

    currentY = addSectionTitle(pdf, "4. DATI OCCUPAZIONALI", currentY);
    currentY = addField(pdf, "Mansione", effectiveMansione, currentY);
    currentY = addField(pdf, "Data Assunzione", worker.data_assunzione, currentY);

    currentY = addSectionTitle(pdf, "5. PROTOCOLLO SANITARIO", currentY);
    // Risks from worker or protocol
    let risks = "Nulla da segnalare";
    if (worker.rischi) {
      try {
        const rArr = JSON.parse(worker.rischi);
        if (Array.isArray(rArr) && rArr.length > 0) risks = rArr.join(", ");
      } catch(e) {}
    }
    currentY = addField(pdf, "Fattori di Rischio", risks, currentY);

    let accertamenti = formatAccertamenti(visit.accertamenti_effettuati || "Come da protocollo");
    currentY = addField(pdf, "Accertamenti", accertamenti, currentY);
  };

  const renderPage2 = (pdf: jsPDF) => {
    pdf.addPage();
    currentY = 30;

    currentY = addSectionTitle(pdf, "6. ANAMNESI LAVORATIVA", currentY);
    currentY = addField(pdf, "Esperienze Pregresse", visit.anamnesi_lavorativa, currentY);

    currentY = addSectionTitle(pdf, "7. ANAMNESI FAMILIARE", currentY);
    currentY = addField(pdf, "Storia Familiare", visit.anamnesi_familiare, currentY);

    currentY = addSectionTitle(pdf, "8. ANAMNESI FISIOLOGICA", currentY);
    // Parse JSON if possible, else raw
    let fisio = visit.anamnesi_fisiologica || "";
    if (fisio.startsWith("{")) {
       try {
         const obj = JSON.parse(fisio);
         currentY = addField(pdf, "Fumo", obj.fumo, currentY);
         currentY = addField(pdf, "Alcol", obj.alcol, currentY);
         currentY = addField(pdf, "Farmaci Abituali", obj.farmaci_abituali, currentY);
         currentY = addField(pdf, "Servizio di Leva", obj.servizio_leva, currentY);
       } catch(e) {
         currentY = addField(pdf, "Dati Fisiologici", fisio, currentY);
       }
    } else {
       currentY = addField(pdf, "Dati Fisiologici", fisio, currentY);
    }

    currentY = addSectionTitle(pdf, "9. ANAMNESI PATOLOGICA REMOTA", currentY);
    currentY = addField(pdf, "Storia Clinica Passata", visit.anamnesi_patologica_remota, currentY);

    currentY = addSectionTitle(pdf, "10. ANAMNESI PATOLOGICA PROSSIMA", currentY);
    currentY = addField(pdf, "Situazione Clinica Attuale", visit.anamnesi_patologica_prossima, currentY);

    currentY = addSectionTitle(pdf, "11. ALLERGIE", currentY);
    currentY = addField(pdf, "Reazioni Allergiche", visit.allergie, currentY);

    currentY = addSectionTitle(pdf, "12. VACCINAZIONI", currentY);
    currentY = addField(pdf, "Stato Vaccinale", visit.vaccinazioni, currentY);
  };

  const renderJudgmentOnly = (pdf: jsPDF): void => {
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("GIUDIZIO DI IDONEITÀ", 105, 40, { align: 'center' });

    currentY = 60;
    currentY = addField(pdf, "Lavoratore", `${worker.cognome} ${worker.nome}`, currentY);
    currentY = addField(pdf, "Data di Nascita", formatDate(worker.data_nascita), currentY);
    currentY = addField(pdf, "Sesso", worker.sesso, currentY);
    currentY = addField(pdf, "Azienda", company.ragione_sociale, currentY);
    currentY = addField(pdf, "Giudizio", visit.giudizio?.toUpperCase(), currentY);
    currentY = addField(pdf, "Prescrizioni", visit.prescrizioni, currentY);
    currentY = addField(pdf, "Prossima Scadenza", visit.scadenza_prossima, currentY);
  };

  if (mode === 'full' || mode === 'combined') {
    renderPage1(doc);
    renderPage2(doc);
    renderPage3(doc, visit, addSectionTitle, addField); // <!-- MODIFICA -->
    renderPage4(doc, visit, company, worker, effectiveDoctor, addSectionTitle, addField); // <!-- MODIFICA -->
    generatePaginaConsenso(doc, visit, worker);
    generatePaginaGiudizio(doc, visit, worker, effectiveDoctor);
  }

  if (mode === 'judgment') {
    renderJudgmentOnly(doc);
  } else if (mode === 'combined') {
    doc.addPage();
    renderJudgmentOnly(doc);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  return doc;
};

/**
 * Render Page 3: Accident history and Informed Consent
 * <!-- MODIFICA -->
 */
const renderPage3 = (pdf: jsPDF, visit: Partial<Visit>, addSectionTitle: any, addField: any): void => {
  pdf.addPage();
  let y = 30;
  y = addSectionTitle(pdf, "13. INCIDENTI E INVALIDITÀ", y);
  y = addField(pdf, "Pregressi/Attuali", visit.incidenti_invalidita, y);

  y = addSectionTitle(pdf, "14. CONSENSO INFORMATO", y);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const consensoText = "Il sottoscritto lavoratore, acquisite le informazioni di cui all'art. 13 del Regolamento UE 2016/679 e del D.Lgs. 81/08, dichiara di essere stato edotto sui rischi professionali e sulle finalità della sorveglianza sanitaria. È stato informato riguardo la necessità di conservazione della cartella sanitaria e di rischio e all'opportunità di sottoporsi ad accertamenti sanitari anche dopo la cessazione dell'attività lavorativa ai sensi dell'art. 25, comma 1, lett. h) del D.Lgs. 81/2008. Esprime il proprio consenso informato all'esecuzione degli accertamenti previsti dal protocollo sanitario e al trattamento dei dati sensibili per fini di medicina del lavoro.";
  const lines = pdf.splitTextToSize(consensoText, 170);
  pdf.text(lines, 20, y);
  y += (lines.length * 5) + 15;

  pdf.setFont("helvetica", "bold");
  pdf.text("Data: ____________________", 20, y);
  pdf.text("Firma del Lavoratore: ____________________________", 110, y);
};

/**
 * Render Page 4: Physical exam, results, and judgment
 * <!-- MODIFICA -->
 */
const renderPage4 = (pdf: jsPDF, visit: Partial<Visit>, _company: Company, _worker: Worker, doctor: DoctorProfile, addSectionTitle: any, addField: any): void => {
  pdf.addPage();
  let y = 30;

  y = addSectionTitle(pdf, "15. ESAME OBIETTIVO PER APPARATI", y);
  y = addField(pdf, "App. Cardiovascolare", visit.eo_cardiaca, y);
  y = addField(pdf, "App. Respiratorio", visit.eo_respiratoria, y);
  y = addField(pdf, "Rachide Cervicale", visit.eo_cervicale, y);
  y = addField(pdf, "Rachide Dorsolombare", visit.eo_dorsolombare, y);
  y = addField(pdf, "Spalle", visit.eo_spalle, y);
  y = addField(pdf, "Arti Superiori", visit.eo_arti_superiori, y);
  y = addField(pdf, "Arti Inferiori", visit.eo_arti_inferiori, y);
  y = addField(pdf, "Altro", visit.eo_altro, y);

  y = addSectionTitle(pdf, "16. ACCERTAMENTI INTEGRATIVI E RISULTATI", y);
  y = addField(pdf, "Esiti Accertamenti", formatAccertamenti(visit.accertamenti_effettuati), y);

  y = addSectionTitle(pdf, "17. CONCLUSIONI E GIUDIZIO DI IDONEITÀ", y);
  y = addField(pdf, "Conclusioni", visit.conclusioni, y);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("GIUDIZIO DI IDONEITÀ:", 20, y);
  pdf.setFontSize(11);
  pdf.text(String(visit.giudizio || "NON ESPRESSO").toUpperCase(), 70, y);
  y += 8;

  y = addField(pdf, "Prescrizioni", visit.prescrizioni, y);
  y = addField(pdf, "Data Prossima Visita", visit.scadenza_prossima, y);

  const today = new Date().toLocaleDateString('it-IT');
  y = addField(pdf, "Trasmissione Giudizio", `Data: ${today} (Consegnato al lavoratore e trasmesso al d.l.)`, y);

  y += 10;
  if (doctor.timbro_immagine) {
    try {
        const imgData = doctor.timbro_immagine.startsWith('data:') ? doctor.timbro_immagine : `data:image/png;base64,${doctor.timbro_immagine}`;
        pdf.addImage(imgData, 'PNG', 140, y, 35, 15);
    } catch(e) {}
  }
  y += 18;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Dott. ${doctor.nome || ''}`, 130, y);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("Firma e Timbro del Medico Competente", 130, y + 4);

  y += 15;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "italic");
  pdf.text("Dichiarazione di conformità: Il presente documento è conforme all'originale archiviato.", 20, y);

  const totalPages = pdf.getNumberOfPages();
  pdf.text(`Documento composto da n. ${totalPages} pagine e n. 0 allegati.`, 20, y + 5);
};

/**
 * Aggiunge una nuova pagina al doc jsPDF con il consenso informato
 */
export const generatePaginaConsenso = (doc: jsPDF, visitData: any, _workerData: any): void => {
  doc.addPage();
  let y = 30;

  const addLocalSection = (title: string, content: any, currentY: number, defaultValue: string = "Nulla da segnalare"): number => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(15, currentY, 180, 7, 'F');
    doc.text(title.toUpperCase(), 20, currentY + 5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const text = (content === null || content === undefined || String(content).trim() === "" || String(content).toLowerCase() === "null") ? defaultValue : String(content);
    const lines = doc.splitTextToSize(text, 170);
    doc.text(lines, 20, currentY + 12);
    return currentY + 12 + (lines.length * 5) + 5;
  };

  y = addLocalSection("Incidenti/Traumi/Infortuni", visitData.incidenti, y, "Nulla da segnalare");
  y = addLocalSection("Invalidità riconosciute", visitData.invalidita, y, "Nessuna");
  y = addLocalSection("Altre notizie utili", visitData.altre_notizie, y, "Nulla da segnalare");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, 180, 7, 'F');
  doc.text("CONSENSO INFORMATO", 20, y + 5);
  y += 12;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const consensoText = "Il lavoratore dichiara che quanto segnalato nell'anamnesi corrisponde al vero, di essere stato edotto sui rischi professionali e sulle finalità della sorveglianza sanitaria. Esprime il proprio consenso informato all'esecuzione degli accertamenti previsti dal protocollo sanitario e al trattamento dei dati sensibili per fini di medicina del lavoro.";
  const lines = doc.splitTextToSize(consensoText, 170);
  doc.text(lines, 20, y);
  y += (lines.length * 5) + 15;

  doc.setFont("helvetica", "bold");
  doc.text("Data: ____________________", 20, y);
  doc.text("Firma del lavoratore: ____________________________", 110, y);
};

/**
 * Aggiunge una nuova pagina al doc jsPDF con il giudizio di idoneità
 */
export const generatePaginaGiudizio = (doc: jsPDF, visitData: any, workerData: any, doctorData: any): void => {
  doc.addPage();
  let y = 20;

  // Header
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Azienda: ${workerData.azienda || 'N.D.'}`, 15, y);
  doc.text(`Data: ${visitData.data_visita || ''}`, 100, y);
  doc.text(`Tipo: ${visitData.tipo_visita || ''}`, 150, y);
  y += 10;

  // Esame obiettivo
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, 180, 7, 'F');
  doc.text("ESAME OBIETTIVO PER APPARATI", 20, y + 5);
  y += 12;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const eo = visitData.esame_obiettivo_strutturato || "Nulla da segnalare";
  const eoLines = doc.splitTextToSize(eo, 170);
  doc.text(eoLines, 20, y);
  y += (eoLines.length * 5) + 10;

  // Giudizio
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Giudizio di idoneità alla mansione specifica:", 20, y);
  doc.text(String(visitData.giudizio || "IDONEO").toUpperCase(), 105, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (visitData.prescrizioni) {
    const pText = `Prescrizioni/Limitazioni: ${visitData.prescrizioni}`;
    const pLines = doc.splitTextToSize(pText, 170);
    doc.text(pLines, 20, y);
    y += (pLines.length * 5) + 2;
  }

  const dataVisita = visitData.data_visita || '';
  doc.text(`Data prossima visita: ${visitData.scadenza_prossima || 'N.D.'}`, 20, y);
  y += 7;
  doc.text(`Trasmissione al lavoratore: ${dataVisita}`, 20, y);
  y += 7;
  doc.text(`Trasmissione al datore: ${dataVisita} a mezzo PEC/Email`, 20, y);
  y += 15;

  // Firma medico
  if (doctorData.timbro_immagine) {
    try {
        const imgData = doctorData.timbro_immagine.startsWith('data:') ? doctorData.timbro_immagine : `data:image/png;base64,${doctorData.timbro_immagine}`;
        doc.addImage(imgData, 'PNG', 140, y - 10, 35, 15);
    } catch(e) {}
  }

  doc.setFont("helvetica", "bold");
  doc.text(`Dott. ${doctorData.nome || ''}`, 130, y + 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Firma del Medico Competente", 130, y + 14);
  y += 25;

  doc.setFont("helvetica", "italic");
  doc.text("La copia elettronica è conforme all'originale", 20, y);
  y += 5;
  const totalPages = doc.getNumberOfPages();
  doc.text(`La presente cartella si compone di n° ${totalPages} pagine`, 20, y);
};
