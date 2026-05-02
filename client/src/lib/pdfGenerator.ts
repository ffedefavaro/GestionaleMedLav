import { jsPDF } from 'jspdf';
import type {
  Visit, Worker, Company, DoctorProfile,
  FamilyHistory, PhysiologicalHistory, WorkHistory
} from '../types';

interface PDFParams {
  mode: 'full' | 'judgment' | 'combined';
  visit: Partial<Visit>;
  worker: Worker;
  company: Company;
  doctor: DoctorProfile;
  workHistory: WorkHistory;
  familyHistory: FamilyHistory;
  physioHistory: PhysiologicalHistory;
  risks: string[];
}

export const generateCompletePDF = (params: PDFParams) => {
  const { mode, visit, worker, company, doctor, workHistory, familyHistory, physioHistory, risks } = params;
  const doc = new jsPDF();
  let currentY = 10;

  const checkPageBreak = (needed: number) => {
    if (currentY + needed > 280) {
      addFooter(doc);
      doc.addPage();
      currentY = 20;
      addHeader(doc, doctor);
    }
  };

  const addHeader = (pdf: jsPDF, dr: DoctorProfile) => {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Dott. ${dr.nome || '____________________'}`, 15, 10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Spec. ${dr.specializzazione || '____________________'} | Iscr. Ordine ${dr.n_iscrizione || '_______'}`, 15, 14);
    pdf.line(15, 16, 195, 16);
    currentY = Math.max(currentY, 22);
  };

  const addFooter = (pdf: jsPDF) => {
    const pageCount = (pdf as any).internal.getNumberOfPages();
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "italic");
    pdf.text(`Pagina ${pageCount} - Documento riservato ai sensi del D.Lgs. 196/2003 e GDPR 2016/679`, 105, 290, { align: 'center' });
  };

  const addSectionTitle = (pdf: jsPDF, title: string) => {
    checkPageBreak(15);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(245, 245, 245);
    pdf.rect(15, currentY, 180, 7, 'F');
    pdf.text(title.toUpperCase(), 20, currentY + 5);
    currentY += 12;
  };

  const addKeyValue = (pdf: jsPDF, label: string, value: string | number | undefined, sub: boolean = false) => {
    const text = String(value || (label.includes("Anamnesi") || label.includes("Esame") ? "Nella norma" : "Non rilevato"));
    const splitValue = pdf.splitTextToSize(text, sub ? 145 : 150);
    checkPageBreak((splitValue.length * 5) + 2);

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${label}:`, sub ? 25 : 20, currentY);

    pdf.setFont("helvetica", "normal");
    pdf.text(splitValue, 60, currentY);
    currentY += (splitValue.length * 5) + 2;
  };

  const renderFullRecord = (pdf: jsPDF) => {
    addHeader(pdf, doctor);

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("CARTELLA SANITARIA E DI RISCHIO", 105, 28, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text("(Art. 41 D.Lgs. 81/08 e s.m.i.)", 105, 34, { align: 'center' });
    currentY = 45;

    // SEZIONE 1 — DATI VISITA
    addSectionTitle(pdf, "SEZIONE 1 — DATI VISITA");
    addKeyValue(pdf, "Data Visita", visit.data_visita);
    addKeyValue(pdf, "Tipo Visita", visit.tipo_visita?.toUpperCase());
    addKeyValue(pdf, "Periodicità", "Annuale"); // Hardcoded for now as example

    // SEZIONE 2 — DATI AZIENDA
    addSectionTitle(pdf, "SEZIONE 2 — DATI AZIENDA");
    addKeyValue(pdf, "Ragione Sociale", company.ragione_sociale);
    addKeyValue(pdf, "Indirizzo", `${company.sede_legale || ''} ${company.sede_operativa ? '| ' + company.sede_operativa : ''}`);
    addKeyValue(pdf, "Attività", company.ateco || "Non specificata");

    // SEZIONE 3 — ANAGRAFICA LAVORATORE
    addSectionTitle(pdf, "SEZIONE 3 — ANAGRAFICA LAVORATORE");
    addKeyValue(pdf, "Nominativo", `${worker.cognome} ${worker.nome}`);
    addKeyValue(pdf, "Nascita", `${worker.data_nascita} (${worker.luogo_nascita || 'N/D'})`);
    addKeyValue(pdf, "Codice Fiscale", worker.codice_fiscale);
    addKeyValue(pdf, "Sesso / Nazionalità", `${worker.sesso} / Italiana`);

    // SEZIONE 4 — DATI OCCUPAZIONALI
    addSectionTitle(pdf, "SEZIONE 4 — DATI OCCUPAZIONALI");
    addKeyValue(pdf, "Mansione", worker.mansione || "N/D");
    addKeyValue(pdf, "Qualifica", worker.mansione);
    addKeyValue(pdf, "Data Assunzione", worker.data_assunzione);

    // SEZIONE 5 — FATTORI DI RISCHIO
    addSectionTitle(pdf, "SEZIONE 5 — FATTORI DI RISCHIO");
    addKeyValue(pdf, "Rischi Protocollo", risks.join(", ") || "Nessun rischio specifico");
    addKeyValue(pdf, "Accertamenti Previsti", "Visita Medica, Esami strumentali periodici");

    // SEZIONE 6 — ANAMNESI LAVORATIVA
    addSectionTitle(pdf, "SEZIONE 6 — ANAMNESI LAVORATIVA");
    if (workHistory.esperienze.length > 0) {
      workHistory.esperienze.forEach((exp, i) => {
        addKeyValue(pdf, `Esperienza ${i+1}`, `${exp.azienda} (${exp.dal}-${exp.al}) - ${exp.mansione}`, true);
      });
      const cumulative = Object.entries(workHistory.esperienze.reduce((acc: Record<string, number>, exp) => {
        const years = Math.max(1, (exp.al === 'attuale' ? new Date().getFullYear() : parseInt(exp.al)) - parseInt(exp.dal));
        exp.esposizioni.forEach(r => acc[r] = (acc[r] || 0) + years);
        return acc;
      }, {})).map(([r, y]) => `${r}: ${y}y`).join(" | ");
      addKeyValue(pdf, "Cumulative", cumulative || "Nessuna");
    } else {
      addKeyValue(pdf, "Pregresse", "Nessuna esperienza lavorativa precedente registrata");
    }
    addKeyValue(pdf, "Infortuni", workHistory.infortuni === 'Sì' ? `${workHistory.infortuni_n} eventi (ultimo ${workHistory.infortuni_ultimo_anno})` : "Nessuno");
    addKeyValue(pdf, "Malattie Prof.", workHistory.malattie_professionali === 'Sì' ? workHistory.malattie_professionali_quale : "No");

    // SEZIONE 7 — ANAMNESI FAMILIARE
    addSectionTitle(pdf, "SEZIONE 7 — ANAMNESI FAMILIARE");
    Object.entries(familyHistory).forEach(([member, data]) => {
      const label = member.replace('_', ' ').charAt(0).toUpperCase() + member.replace('_', ' ').slice(1);
      const content = data.patologie.length > 0 || data.deceduto
        ? `${data.deceduto ? 'Deceduto' : 'Vivente'}. Patologie: ${data.patologie.join(", ") || 'Nessuna'} ${data.altro_note ? '(' + data.altro_note + ')' : ''}`
        : "Nulla da segnalare";
      addKeyValue(pdf, label, content);
    });

    // SEZIONE 8 — ANAMNESI FISIOLOGICA
    addSectionTitle(pdf, "SEZIONE 8 — ANAMNESI FISIOLOGICA");
    addKeyValue(pdf, "Sviluppo", `Gravidanza: ${physioHistory.sviluppo.gravidanza_parto}. Psicomotorio: ${physioHistory.sviluppo.psicomotorio}`);
    addKeyValue(pdf, "Fumo", physioHistory.abitudini.fumo === 'Fumatore' ? `Sì (${physioHistory.abitudini.fumo_sigarette_die} sig/die)` : physioHistory.abitudini.fumo);
    addKeyValue(pdf, "Alcol", physioHistory.abitudini.alcol);
    addKeyValue(pdf, "Allergie", physioHistory.abitudini.nessuna_allergia ? "Nessuna" : physioHistory.abitudini.allergie_note);

    // SEZIONE 9 — ANAMNESI PATOLOGICA
    addSectionTitle(pdf, "SEZIONE 9 — ANAMNESI PATOLOGICA");
    addKeyValue(pdf, "Remota / Prossima", visit.anamnesi_patologica || "Negativa");

    // SEZIONE 10 — ESAME OBIETTIVO
    addSectionTitle(pdf, "SEZIONE 10 — ESAME OBIETTIVO");
    addKeyValue(pdf, "Parametri", `H: ${visit.altezza}cm | P: ${visit.peso}kg | BMI: ${visit.bmi} | PA: ${visit.p_sistolica}/${visit.p_diastolica} | FC: ${visit.frequenza}`);
    addKeyValue(pdf, "App. Cardiovasc.", `Toni ${visit.eo_toni_puri ? 'puri' : 'impuri'}, ${visit.eo_toni_ritmici ? 'ritmici' : 'aritmici'}. Varici: ${visit.eo_varici ? 'Presenti' : 'Assenti'}`);
    addKeyValue(pdf, "App. Digerente", `Addome ${visit.eo_addome_piano ? 'piano' : 'globoso'}, ${visit.eo_trattabile ? 'trattabile' : 'non trattabile'}`);
    addKeyValue(pdf, "App. Osteoart.", `Lasègue DX: ${visit.eo_lasegue_dx}, SX: ${visit.eo_lasegue_sx}. Paravertebrali: ${visit.eo_palpazione_paravertebrali}`);
    addKeyValue(pdf, "Sist. Nervoso", `Tinel: ${visit.eo_tinel}. Phalen: ${visit.eo_phalen}`);
    addKeyValue(pdf, "Visus / Udito", `Nat: ${visit.eo_visus_nat_os}/${visit.eo_visus_nat_od}. Udito ridotto: ${visit.eo_udito_ridotto ? 'Sì' : 'No'}`);
    if (visit.eo_note) addKeyValue(pdf, "Note EO", visit.eo_note);

    // SEZIONE 11 — ACCERTAMENTI
    addSectionTitle(pdf, "SEZIONE 11 — ACCERTAMENTI INTEGRATIVI");
    addKeyValue(pdf, "Risultati", visit.accertamenti_effettuati || "Nessun accertamento integrativo eseguito");

    // SEZIONE 12 — GIUDIZIO
    addSectionTitle(pdf, "SEZIONE 12 — CONCLUSIONI E GIUDIZIO");
    pdf.setFont("helvetica", "bold");
    addKeyValue(pdf, "Giudizio Finale", visit.giudizio?.toUpperCase());
    addKeyValue(pdf, "Prescrizioni", visit.prescrizioni || "Nessuna prescrizione o limitazione");
    addKeyValue(pdf, "Prossima Visita", visit.scadenza_prossima);

    // SEZIONE 13 — TRASMISSIONE
    addSectionTitle(pdf, "SEZIONE 13 — TRASMISSIONE");
    addKeyValue(pdf, "Al Lavoratore", `${visit.trasmissione_lavoratore_data || 'In data odierna'} via ${visit.trasmissione_lavoratore_metodo || 'Consegna a mani'}`);
    addKeyValue(pdf, "Al Datore", `${visit.trasmissione_datore_data || 'Entro 5gg'} via ${visit.trasmissione_datore_metodo || 'PEC/Email'}`);

    // SEZIONE 14 — FIRME
    addSectionTitle(pdf, "SEZIONE 14 — FIRME");
    checkPageBreak(40);
    pdf.setFontSize(9);
    pdf.text("Firma del Lavoratore (per presa visione e copia)", 20, currentY + 15);
    pdf.line(20, currentY + 10, 80, currentY + 10);

    pdf.text("Firma del Medico Competente", 130, currentY + 15);
    pdf.line(130, currentY + 10, 190, currentY + 10);

    addFooter(pdf);
  };

  const renderJudgmentOnly = (pdf: jsPDF) => {
    addHeader(pdf, doctor);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("GIUDIZIO DI IDONEITÀ ALLA MANSIONE SPECIFICA", 105, 35, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text("(Art. 41 D.Lgs. 81/08)", 105, 42, { align: 'center' });

    currentY = 60;
    pdf.rect(15, currentY, 180, 50);
    pdf.setFontSize(10);
    pdf.text(`Lavoratore: ${worker.cognome} ${worker.nome}`, 20, currentY + 10);
    pdf.text(`Codice Fiscale: ${worker.codice_fiscale}`, 20, currentY + 18);
    pdf.text(`Azienda: ${company.ragione_sociale}`, 20, currentY + 26);
    pdf.text(`Mansione: ${worker.mansione}`, 20, currentY + 34);
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
    pdf.text("PRESCRIZIONI / LIMITAZIONI:", 15, currentY);
    pdf.setFont("helvetica", "normal");
    const presc = pdf.splitTextToSize(visit.prescrizioni || "Nessuna", 170);
    pdf.text(presc, 15, currentY + 8);

    currentY += 40;
    pdf.text(`Data prossima visita entro il: ${visit.scadenza_prossima}`, 15, currentY);

    currentY += 40;
    pdf.text("Firma del Lavoratore", 20, currentY + 5);
    pdf.line(20, currentY, 80, currentY);
    pdf.text("Firma del Medico Competente", 130, currentY + 5);
    pdf.line(130, currentY, 190, currentY);

    addFooter(pdf);
  };

  if (mode === 'full' || mode === 'combined') {
    renderFullRecord(doc);
  }

  if (mode === 'combined') {
    doc.addPage();
    currentY = 10;
    renderJudgmentOnly(doc);
  } else if (mode === 'judgment') {
    renderJudgmentOnly(doc);
  }

  const filename = mode === 'judgment' ? `Giudizio_${worker.cognome}.pdf` : `Cartella_3A_${worker.cognome}.pdf`;
  doc.save(filename);
  return doc;
};
