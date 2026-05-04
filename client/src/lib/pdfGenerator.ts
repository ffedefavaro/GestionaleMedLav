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
  eta_decesso?: number;
  causa?: string;
  patologie: string[];
  altro_note?: string;
}

export interface FamilyHistory {
  padre: FamilyMemberHistory;
  madre: FamilyMemberHistory;
  fratelli_sorelle: FamilyMemberHistory;
  nonno_paterno: FamilyMemberHistory;
  nonna_paterna: FamilyMemberHistory;
  nonno_materno: FamilyMemberHistory;
  nonna_materna: FamilyMemberHistory;
}

export interface PhysiologicalHistory {
  sviluppo: {
    gravidanza_parto: 'Regolari' | 'Complicazioni';
    gravidanza_note?: string;
    psicomotorio: 'Regolare' | 'Rallentato';
    psicomotorio_note?: string;
  };
  puberta: {
    sviluppo_puberale: 'Regolare' | 'Anticipato' | 'Ritardato';
    menarca_eta?: number;
    ciclo?: 'Regolare' | 'Irregolare' | 'Amenorrea';
    gravidanze_n?: number;
    parti_n?: number;
    aborti_n?: number;
    menopausa: boolean;
    menopausa_eta?: number;
  };
  abitudini: {
    fumo: 'Non fumatore' | 'Ex fumatore' | 'Fumatore';
    fumo_sigarette_die?: number;
    fumo_anni?: number;
    fumo_anno_cessazione?: number;
    alcol: 'No' | 'Occasionale' | 'Quotidiano';
    alcol_unita_die?: number;
    attivita_fisica: 'Sedentario' | 'Leggera' | 'Moderata' | 'Intensa';
    dieta: 'Onnivora' | 'Vegetariana' | 'Vegana' | 'Altro';
    dieta_altro?: string;
    farmaci_abituali?: string;
    nessuna_allergia: boolean;
    allergie_note?: string;
  };
  sonno: {
    qualita: 'Buona' | 'Disturbi occasionali' | 'Insonnia';
  };
}

export interface WorkExperience {
  azienda: string;
  ateco?: string;
  mansione: string;
  dal: string;
  al: string;
  esposizioni: string[];
  note?: string;
}

export interface WorkHistory {
  esperienze: WorkExperience[];
  infortuni: 'Nessuno' | 'Sì';
  infortuni_n?: number;
  infortuni_ultimo_anno?: number;
  infortuni_tipo?: string;
  malattie_professionali: 'No' | 'Sì';
  malattie_professionali_quale?: string;
  malattie_professionali_anno?: number;
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
  altezza?: number;
  peso?: number;
  bmi?: number;
  p_sistolica?: number;
  p_diastolica?: number;
  frequenza?: number;
  spo2?: number;
  eo_cardiaca?: string;
  eo_respiratoria?: string;
  eo_cervicale?: string;
  eo_dorsolombare?: string;
  eo_spalle?: string;
  eo_arti_superiori?: string;
  eo_arti_inferiori?: string;
  eo_altro?: string;
  incidenti_invalidita?: string;
  conclusioni?: string;
  giudizio?: string;
  prescrizioni?: string;
  scadenza_prossima?: string;
  accertamenti_effettuati?: string;
  trasmissione_lavoratore_data?: string;
  trasmissione_lavoratore_metodo?: string;
  trasmissione_datore_data?: string;
  trasmissione_datore_metodo?: string;
  eo_note?: string;
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
  workHistory?: WorkHistory;
  familyHistory?: FamilyHistory;
  physioHistory?: PhysiologicalHistory;
  risks?: string[];
}

type PDFValue = string | number | boolean | undefined | null;

export const generateCompletePDF = (params: PDFParams): jsPDF => {
  const { mode, visit, worker, company, doctor, workHistory, familyHistory, physioHistory, risks } = params;

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
  if (!effectiveMansione || String(effectiveMansione).toLowerCase() === "null") effectiveMansione = "Mansione non definita";

  const calculateAge = (dob: string): string => {
    if (!dob) return "N/D";
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return "N/D";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age > 0 ? String(age) : "N/D";
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

  const formatValue = (val: PDFValue): string => {
    if (val === null || val === undefined || String(val).trim() === "" || String(val).toLowerCase() === "null") {
      return "Nulla da segnalare";
    }
    if (val === true) return "Sì / Presente / Nella norma";
    if (val === false) return "No / Assente / Non rilevato";
    return String(val);
  };

  const addField = (pdf: jsPDF, label: string, value: PDFValue, y: number): number => {
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
    pdf.setFontSize(10);
    pdf.text("(Art. 41 D.Lgs. 81/08 e s.m.i. - Allegato 3A)", 105, 38, { align: 'center' });

    currentY = 45;
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
    currentY = addField(pdf, "Data e Luogo Nascita", `${worker.data_nascita} (${worker.luogo_nascita || 'N/D'})`, currentY);
    currentY = addField(pdf, "Età", calculateAge(worker.data_nascita), currentY);
    currentY = addField(pdf, "Sesso", worker.sesso, currentY);

    currentY = addSectionTitle(pdf, "4. DATI OCCUPAZIONALI", currentY);
    currentY = addField(pdf, "Mansione", effectiveMansione, currentY);
    currentY = addField(pdf, "Data Assunzione", worker.data_assunzione, currentY);

    currentY = addSectionTitle(pdf, "5. PROTOCOLLO SANITARIO", currentY);
    let riskText = "Nulla da segnalare";
    if (risks && risks.length > 0) {
      riskText = risks.join(", ");
    } else if (worker.rischi) {
      try {
        const rArr = JSON.parse(worker.rischi);
        if (Array.isArray(rArr) && rArr.length > 0) riskText = rArr.join(", ");
      } catch(e) {}
    }
    currentY = addField(pdf, "Fattori di Rischio", riskText, currentY);

    let accertamenti = visit.accertamenti_effettuati || "Come da protocollo";
    currentY = addField(pdf, "Accertamenti", accertamenti, currentY);
  };

  const renderPage2 = (pdf: jsPDF) => {
    pdf.addPage();
    currentY = 30;

    currentY = addSectionTitle(pdf, "6. ANAMNESI LAVORATIVA", currentY);
    if (workHistory && workHistory.esperienze && workHistory.esperienze.length > 0) {
        workHistory.esperienze.forEach((exp, i) => {
          currentY = addField(pdf, `Esperienza ${i+1}`, `${exp.azienda} (${exp.dal}-${exp.al}) - ${exp.mansione} [Rischi: ${exp.esposizioni.join(", ")}]`, currentY);
        });
        currentY = addField(pdf, "Infortuni", workHistory.infortuni === 'Sì' ? `${workHistory.infortuni_n} eventi (ultimo ${workHistory.infortuni_ultimo_anno})` : "Nessuno", currentY);
    } else {
        currentY = addField(pdf, "Esperienze Pregresse", visit.anamnesi_lavorativa, currentY);
    }

    currentY = addSectionTitle(pdf, "7. ANAMNESI FAMILIARE", currentY);
    if (familyHistory) {
        Object.entries(familyHistory).forEach(([member, data]) => {
            const label = member.replace('_', ' ').charAt(0).toUpperCase() + member.replace('_', ' ').slice(1);
            const content = data.patologie.length > 0 || data.deceduto
              ? `${data.deceduto ? 'Deceduto' : 'Vivente'}. Patologie: ${data.patologie.join(", ") || 'Nessuna'} ${data.altro_note ? '(' + data.altro_note + ')' : ''}`
              : "Nulla da segnalare";
            currentY = addField(pdf, label, content, currentY);
        });
    } else {
        currentY = addField(pdf, "Storia Familiare", visit.anamnesi_familiare, currentY);
    }

    currentY = addSectionTitle(pdf, "8. ANAMNESI FISIOLOGICA", currentY);
    if (physioHistory) {
        currentY = addField(pdf, "Sviluppo", `Gravidanza: ${physioHistory.sviluppo.gravidanza_parto}. Psicomotorio: ${physioHistory.sviluppo.psicomotorio}`, currentY);
        currentY = addField(pdf, "Fumo", physioHistory.abitudini.fumo === 'Fumatore' ? `Sì (${physioHistory.abitudini.fumo_sigarette_die} sig/die)` : physioHistory.abitudini.fumo, currentY);
        currentY = addField(pdf, "Alcol", physioHistory.abitudini.alcol, currentY);
        currentY = addField(pdf, "Attività Fisica", physioHistory.abitudini.attivita_fisica, currentY);
        currentY = addField(pdf, "Allergie", physioHistory.abitudini.nessuna_allergia ? "Nessuna nota" : physioHistory.abitudini.allergie_note, currentY);
    } else {
        currentY = addField(pdf, "Dati Fisiologici", visit.anamnesi_fisiologica, currentY);
    }

    currentY = addSectionTitle(pdf, "9. ANAMNESI PATOLOGICA REMOTA", currentY);
    currentY = addField(pdf, "Storia Clinica Passata", visit.anamnesi_patologica_remota, currentY);

    currentY = addSectionTitle(pdf, "10. ANAMNESI PATOLOGICA PROSSIMA", currentY);
    currentY = addField(pdf, "Situazione Clinica Attuale", visit.anamnesi_patologica_prossima, currentY);

    currentY = addSectionTitle(pdf, "11. ALLERGIE E VACCINAZIONI", currentY);
    currentY = addField(pdf, "Reazioni Allergiche", visit.allergie, currentY);
    currentY = addField(pdf, "Stato Vaccinale", visit.vaccinazioni, currentY);
  };

  const renderJudgmentOnly = (pdf: jsPDF): void => {
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("GIUDIZIO DI IDONEITÀ ALLA MANSIONE SPECIFICA", 105, 35, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text("(Art. 41 D.Lgs. 81/08)", 105, 42, { align: 'center' });

    currentY = 55;
    pdf.rect(15, currentY, 180, 50);
    pdf.setFontSize(10);
    pdf.text(`Lavoratore: ${worker.cognome} ${worker.nome}`, 20, currentY + 10);
    pdf.text(`Codice Fiscale: ${worker.codice_fiscale}`, 20, currentY + 18);
    pdf.text(`Azienda: ${company.ragione_sociale}`, 20, currentY + 26);
    pdf.text(`Mansione: ${effectiveMansione}`, 20, currentY + 34);
    pdf.text(`Data Visita: ${visit.data_visita}`, 20, currentY + 42);

    currentY += 65;
    pdf.setFontSize(12);
    pdf.text("ESITO DELLA SORVEGLIANZA SANITARIA:", 15, currentY);
    currentY += 10;
    pdf.setFontSize(18);
    pdf.text(visit.giudizio?.toUpperCase() || "IDONEO", 105, currentY + 5, { align: 'center' });

    currentY += 25;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("PRESCRIZIONI / LIMITAZIONI / SUGGERIMENTI:", 15, currentY);
    pdf.setFont("helvetica", "normal");
    const presc = pdf.splitTextToSize(visit.prescrizioni || "Nessuna", 175);
    pdf.text(presc, 15, currentY + 8);

    currentY += 40;
    pdf.text(`Data prossima visita entro il: ${visit.scadenza_prossima}`, 15, currentY);

    currentY += 30;
    pdf.text("Firma del Lavoratore", 20, currentY + 10);
    pdf.line(20, currentY + 5, 80, currentY + 5);

    const drSignatureName = effectiveDoctor.nome || "____________________";
    pdf.text(`Firma Medico Competente (Dott. ${drSignatureName})`, 130, currentY + 10);
    pdf.line(130, currentY + 5, 190, currentY + 5);
  };

  if (mode === 'full' || mode === 'combined') {
    renderPage1(doc);
    renderPage2(doc);
    renderPage3(doc, visit, addSectionTitle, addField);
    renderPage4(doc, visit, company, worker, effectiveDoctor, addSectionTitle, addField);
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
 */
const renderPage3 = (pdf: jsPDF, visit: Partial<Visit>, addSectionTitle: any, addField: any): void => {
  pdf.addPage();
  let y = 30;
  y = addSectionTitle(pdf, "12. INCIDENTI E INVALIDITÀ", y);
  y = addField(pdf, "Pregressi/Attuali", visit.incidenti_invalidita, y);

  y = addSectionTitle(pdf, "13. CONSENSO INFORMATO", y);
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
 */
const renderPage4 = (pdf: jsPDF, visit: Partial<Visit>, _company: Company, _worker: Worker, doctor: DoctorProfile, addSectionTitle: any, addField: any): void => {
  pdf.addPage();
  let y = 30;

  y = addSectionTitle(pdf, "14. ESAME OBIETTIVO PER APPARATI", y);
  const vitalParams = `H: ${visit.altezza}cm | P: ${visit.peso}kg | BMI: ${visit.bmi} | PA: ${visit.p_sistolica}/${visit.p_diastolica} mmHg | FC: ${visit.frequenza} bpm | SpO2: ${visit.spo2}%`;
  y = addField(pdf, "Parametri Vitali", vitalParams, y);
  y = addField(pdf, "App. Cardiovascolare", visit.eo_cardiaca, y);
  y = addField(pdf, "App. Respiratorio", visit.eo_respiratoria, y);
  y = addField(pdf, "Rachide Cervicale", visit.eo_cervicale, y);
  y = addField(pdf, "Rachide Dorsolombare", visit.eo_dorsolombare, y);
  y = addField(pdf, "Spalle", visit.eo_spalle, y);
  y = addField(pdf, "Arti Superiori", visit.eo_arti_superiori, y);
  y = addField(pdf, "Arti Inferiori", visit.eo_arti_inferiori, y);
  y = addField(pdf, "Altro", visit.eo_altro, y);

  y = addSectionTitle(pdf, "15. ACCERTAMENTI INTEGRATIVI E RISULTATI", y);
  y = addField(pdf, "Esiti Accertamenti", visit.accertamenti_effettuati, y);

  y = addSectionTitle(pdf, "16. CONCLUSIONI E GIUDIZIO DI IDONEITÀ", y);
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
