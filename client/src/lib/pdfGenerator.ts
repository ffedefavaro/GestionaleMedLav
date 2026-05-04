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
  // Page 3: Physical Exam
  altezza?: number | string;
  peso?: number | string;
  bmi?: number | string;
  p_sistolica?: number | string;
  p_diastolica?: number | string;
  frequenza?: number | string;
  spo2?: number | string;
  eo_cardiaca?: string;
  eo_respiratoria?: string;
  eo_cervicale?: string;
  eo_dorsolombare?: string;
  eo_spalle?: string;
  eo_arti_superiori?: string;
  eo_arti_inferiori?: string;
  eo_altro?: string;
  // Page 4: Judgment
  giudizio?: string;
  prescrizioni?: string;
  scadenza_prossima?: string;
  accertamenti_effettuati?: string;
  // Page 5: Spine Evaluation (JSON stringified SpineEvaluation)
  valutazione_rachide?: string;
  // Page 6: Audiometry (JSON stringified AudiometryData)
  audiometria?: string;
}

export interface SpineEvaluation {
  cervicale_flette: string;
  cervicale_estende: string;
  cervicale_ruota_sx: string;
  cervicale_ruota_dx: string;
  dorso_lombare_flette: string;
  dorso_lombare_lasegue_dx: string;
  dorso_lombare_lasegue_sx: string;
  riflessi_rotulei: string;
  riflessi_achillei: string;
}

export interface AudiometryData {
  dx: Record<number, number>; // frequency -> dB
  sx: Record<number, number>;
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
    let risks = "Nulla da segnalare";
    if (worker.rischi) {
      try {
        const rArr = JSON.parse(worker.rischi);
        if (Array.isArray(rArr) && rArr.length > 0) risks = rArr.join(", ");
      } catch(e) {}
    }
    currentY = addField(pdf, "Fattori di Rischio", risks, currentY);

    let accertamentiPrevisti = "Come da protocollo";
    currentY = addField(pdf, "Accertamenti Previsti", accertamentiPrevisti, currentY);
  };

  const renderPage2 = (pdf: jsPDF) => {
    pdf.addPage();
    currentY = 30;

    currentY = addSectionTitle(pdf, "6. ANAMNESI LAVORATIVA", currentY);
    currentY = addField(pdf, "Esperienze Pregresse", visit.anamnesi_lavorativa, currentY);

    currentY = addSectionTitle(pdf, "7. ANAMNESI FAMILIARE", currentY);
    currentY = addField(pdf, "Storia Familiare", visit.anamnesi_familiare, currentY);

    currentY = addSectionTitle(pdf, "8. ANAMNESI FISIOLOGICA", currentY);
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

  const renderPage3 = (pdf: jsPDF) => {
    pdf.addPage();
    currentY = 30;
    currentY = addSectionTitle(pdf, "13. ESAME OBIETTIVO E PARAMETRI", currentY);

    currentY = addField(pdf, "Altezza (cm)", visit.altezza, currentY);
    currentY = addField(pdf, "Peso (kg)", visit.peso, currentY);
    currentY = addField(pdf, "BMI", visit.bmi, currentY);
    currentY = addField(pdf, "Pressione Sistolica", visit.p_sistolica, currentY);
    currentY = addField(pdf, "Pressione Diastolica", visit.p_diastolica, currentY);
    currentY = addField(pdf, "Frequenza Cardiaca", visit.frequenza, currentY);
    currentY = addField(pdf, "SpO2 (%)", visit.spo2, currentY);

    currentY = addSectionTitle(pdf, "DETTAGLI ESAME OBIETTIVO", currentY);
    currentY = addField(pdf, "App. Cardiovascolare", visit.eo_cardiaca, currentY);
    currentY = addField(pdf, "App. Respiratorio", visit.eo_respiratoria, currentY);
    currentY = addField(pdf, "Rachide Cervicale", visit.eo_cervicale, currentY);
    currentY = addField(pdf, "Rachide Dorsolombare", visit.eo_dorsolombare, currentY);
    currentY = addField(pdf, "Spalle", visit.eo_spalle, currentY);
    currentY = addField(pdf, "Arti Superiori", visit.eo_arti_superiori, currentY);
    currentY = addField(pdf, "Arti Inferiori", visit.eo_arti_inferiori, currentY);
    currentY = addField(pdf, "Altro", visit.eo_altro, currentY);
  };

  const renderPage4 = (pdf: jsPDF): void => {
    if (mode === 'full' || mode === 'combined') {
       pdf.addPage();
    }
    currentY = 40;
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("GIUDIZIO DI IDONEITÀ", 105, currentY, { align: 'center' });

    currentY += 20;
    currentY = addField(pdf, "Lavoratore", `${worker.cognome} ${worker.nome}`, currentY);
    currentY = addField(pdf, "Codice Fiscale", worker.codice_fiscale, currentY);
    currentY = addField(pdf, "Azienda", company.ragione_sociale, currentY);
    currentY = addField(pdf, "Mansione", effectiveMansione, currentY);
    currentY = addField(pdf, "Data Visita", visit.data_visita, currentY);

    currentY += 10;
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("ESITO DELLA SORVEGLIANZA SANITARIA:", 20, currentY);
    currentY += 10;
    pdf.setFontSize(14);
    pdf.text(formatValue(visit.giudizio).toUpperCase(), 105, currentY, { align: 'center' });

    currentY += 15;
    currentY = addField(pdf, "Prescrizioni / Limitazioni", visit.prescrizioni, currentY);
    currentY = addField(pdf, "Prossima Scadenza", visit.scadenza_prossima, currentY);
    currentY = addField(pdf, "Accertamenti Eseguiti", visit.accertamenti_effettuati, currentY);

    currentY += 20;
    pdf.setFontSize(9);
    pdf.text("Firma del Lavoratore", 20, currentY);
    pdf.line(20, currentY + 2, 80, currentY + 2);

    pdf.text("Firma del Medico Competente", 130, currentY);
    pdf.line(130, currentY + 2, 190, currentY + 2);
  };

  const renderPage5 = (pdf: jsPDF) => {
    if (!visit.valutazione_rachide) return;
    let data: SpineEvaluation;
    try {
      data = JSON.parse(visit.valutazione_rachide);
    } catch(e) { return; }

    pdf.addPage();
    currentY = 30;
    currentY = addSectionTitle(pdf, "15. VALUTAZIONE FUNZIONALE RACHIDE", currentY);

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("MOBILITÀ CERVICALE", 20, currentY);
    currentY += 7;

    const tableX = 20;
    const col1 = 60;

    const addTableRow = (pdf: jsPDF, label: string, val: string, y: number) => {
      pdf.setFont("helvetica", "normal");
      pdf.rect(tableX, y, 170, 7);
      pdf.text(label, tableX + 2, y + 5);
      pdf.line(tableX + col1, y, tableX + col1, y + 7);
      pdf.text(formatValue(val), tableX + col1 + 2, y + 5);
      return y + 7;
    };

    currentY = addTableRow(pdf, "Flessione", data.cervicale_flette, currentY);
    currentY = addTableRow(pdf, "Estensione", data.cervicale_estende, currentY);
    currentY = addTableRow(pdf, "Rotazione SX", data.cervicale_ruota_sx, currentY);
    currentY = addTableRow(pdf, "Rotazione DX", data.cervicale_ruota_dx, currentY);

    currentY += 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("MOBILITÀ DORSO-LOMBARE", 20, currentY);
    currentY += 7;
    currentY = addTableRow(pdf, "Flessione", data.dorso_lombare_flette, currentY);
    currentY = addTableRow(pdf, "Lasègue DX", data.dorso_lombare_lasegue_dx, currentY);
    currentY = addTableRow(pdf, "Lasègue SX", data.dorso_lombare_lasegue_sx, currentY);

    currentY += 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("RIFLESSI", 20, currentY);
    currentY += 7;
    currentY = addTableRow(pdf, "Rotulei", data.riflessi_rotulei, currentY);
    currentY = addTableRow(pdf, "Achillei", data.riflessi_achillei, currentY);
  };

  const renderPage6 = (pdf: jsPDF) => {
    if (!visit.audiometria) return;
    let data: AudiometryData;
    try {
      data = JSON.parse(visit.audiometria);
    } catch(e) { return; }

    pdf.addPage();
    currentY = 30;
    currentY = addSectionTitle(pdf, "16. SCHEDA AUDIOMETRICA", currentY);

    const freqs = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];

    // Draw Table
    pdf.setFontSize(8);
    let x = 20;
    pdf.rect(x, currentY, 170, 21);
    pdf.line(x, currentY + 7, x + 170, currentY + 7);
    pdf.line(x, currentY + 14, x + 170, currentY + 14);

    pdf.text("Freq (Hz)", x + 2, currentY + 5);
    pdf.text("Orecchio DX (dB)", x + 2, currentY + 12);
    pdf.text("Orecchio SX (dB)", x + 2, currentY + 19);

    let cellW = 145 / 8;
    freqs.forEach((f, i) => {
       let cx = x + 25 + (i * cellW);
       pdf.line(cx, currentY, cx, currentY + 21);
       pdf.text(f.toString(), cx + 2, currentY + 5);
       pdf.text(formatValue(data.dx[f]), cx + 2, currentY + 12);
       pdf.text(formatValue(data.sx[f]), cx + 2, currentY + 19);
    });

    currentY += 30;

    // Graph area
    const graphX = 30;
    const graphY = currentY;
    const graphW = 150;
    const graphH = 80;

    pdf.rect(graphX, graphY, graphW, graphH);
    // Grid
    pdf.setDrawColor(200);
    for (let i = 0; i <= 10; i++) {
       let gy = graphY + (i * (graphH / 10));
       pdf.line(graphX, gy, graphX + graphW, gy);
       pdf.text((i * 10).toString(), graphX - 8, gy + 2);
    }
    for (let i = 0; i < 8; i++) {
       let gx = graphX + (i * (graphW / 7));
       pdf.line(gx, graphY, gx, graphY + graphH);
       pdf.text(freqs[i].toString(), gx - 5, graphY + graphH + 5);
    }

    const getPoint = (fIdx: number, db: any) => {
       let val = parseInt(db);
       if (isNaN(val)) return null;
       return {
          x: graphX + (fIdx * (graphW / 7)),
          y: graphY + (val * (graphH / 100))
       };
    };

    // DX: Red
    pdf.setDrawColor(255, 0, 0);
    pdf.setLineWidth(0.5);
    let lastP: any = null;
    freqs.forEach((f, i) => {
       let p = getPoint(i, data.dx[f]);
       if (p) {
          pdf.circle(p.x, p.y, 1);
          if (lastP) pdf.line(lastP.x, lastP.y, p.x, p.y);
          lastP = p;
       }
    });

    // SX: Blue
    pdf.setDrawColor(0, 0, 255);
    lastP = null;
    freqs.forEach((f, i) => {
       let p = getPoint(i, data.sx[f]);
       if (p) {
          pdf.rect(p.x - 1, p.y - 1, 2, 2);
          if (lastP) pdf.line(lastP.x, lastP.y, p.x, p.y);
          lastP = p;
       }
    });

    pdf.setDrawColor(0);
    pdf.setLineWidth(0.2);
    currentY = graphY + graphH + 20;
    pdf.text("Legenda: Rosso (Orecchio DX), Blu (Orecchio SX)", graphX, currentY);
  };

  if (mode === 'full') {
    renderPage1(doc);
    renderPage2(doc);
    renderPage3(doc);
    renderPage4(doc);
    renderPage5(doc);
    renderPage6(doc);
  } else if (mode === 'judgment') {
    renderPage4(doc);
  } else if (mode === 'combined') {
    renderPage1(doc);
    renderPage2(doc);
    doc.addPage();
    renderPage4(doc);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  return doc;
};
