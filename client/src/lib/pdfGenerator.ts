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
    currentY = addField(pdf, "Data di Nascita", worker.data_nascita, currentY);
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

    let accertamenti = visit.accertamenti_effettuati || "Come da protocollo";
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
    currentY = addField(pdf, "Azienda", company.ragione_sociale, currentY);
    currentY = addField(pdf, "Giudizio", visit.giudizio?.toUpperCase(), currentY);
    currentY = addField(pdf, "Prescrizioni", visit.prescrizioni, currentY);
    currentY = addField(pdf, "Prossima Scadenza", visit.scadenza_prossima, currentY);
  };

  if (mode === 'full' || mode === 'combined') {
    renderPage1(doc);
    renderPage2(doc);
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
