import { jsPDF } from 'jspdf';
import { executeQuery } from './db';
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

type PDFValue = string | number | boolean | undefined | null;

export const generateCompletePDF = (params: PDFParams): jsPDF => {
  const { mode, visit, worker, company, doctor, workHistory, familyHistory, physioHistory, risks } = params;

  // 1. BUG FIX: Mansione "null" - Read from protocol if missing
  let effectiveMansione: string = worker.mansione || "";
  if (!effectiveMansione || String(effectiveMansione) === "null" || String(effectiveMansione).trim() === "") {
    if (worker.protocol_id) {
      const proto = executeQuery("SELECT mansione FROM protocols WHERE id = ?", [worker.protocol_id]);
      if (proto && proto.length > 0 && proto[0].mansione) {
        effectiveMansione = String(proto[0].mansione);
      }
    }
  }
  if (!effectiveMansione || String(effectiveMansione) === "null") effectiveMansione = "Mansione non definita";

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
  let currentY = 30;

  // 4. HEADER: Nome medico e data visita su ogni pagina
  const addHeader = (pdf: jsPDF, pageIndex: number): void => {
    pdf.setPage(pageIndex);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");

    // 2. BUG FIX: Dati medico da Settings
    const drName = doctor.nome || "Medico Competente (Dati non configurati)";
    const drSpec = doctor.specializzazione || "Medicina del Lavoro";
    const drIscr = doctor.n_iscrizione || "N/D";
    const visitDate = visit.data_visita || "N/D";

    pdf.text(`Dott. ${drName} | ${drSpec} | Iscr. Ordine ${drIscr}`, 15, 10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Data Visita: ${visitDate}`, 195, 10, { align: 'right' });
    pdf.line(15, 12, 195, 12);
  };

  // 3. FOOTER: Documento riservato + Pagina X di Y
  const addFooter = (pdf: jsPDF, pageIndex: number, totalPages: number): void => {
    pdf.setPage(pageIndex);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "italic");
    const footerText = `Documento riservato - D.Lgs. 196/2003 | Pagina ${pageIndex} di ${totalPages}`;
    pdf.text(footerText, 105, 290, { align: 'center' });
  };

  const checkPageBreak = (needed: number): void => {
    if (currentY + needed > 275) {
      doc.addPage();
      currentY = 25;
    }
  };

  const addSectionTitle = (pdf: jsPDF, title: string): void => {
    checkPageBreak(15);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(240, 240, 240);
    pdf.rect(15, currentY, 180, 7, 'F');
    pdf.text(title.toUpperCase(), 20, currentY + 5);
    currentY += 12;
  };

  const addKeyValue = (pdf: jsPDF, label: string, value: PDFValue, sub: boolean = false): void => {
    let text = "Non rilevato";
    if (value === true) text = "Sì / Presente / Nella norma";
    else if (value === false) text = "No / Assente / Non rilevato";
    else if (value !== undefined && value !== null && String(value).trim() !== "" && String(value) !== "null") text = String(value);

    // Context-aware defaults
    if (text === "Non rilevato" || text === "Nulla da segnalare") {
       if (label.includes("Anamnesi") || label.includes("familiare") || label.includes("storia")) text = "Nulla da segnalare";
       if (label.includes("App.") || label.includes("Sist.") || label.includes("Giordano") || label.includes("Esame") || label.includes("Toni")) text = "Nella norma";
    }

    const splitValue: string[] = pdf.splitTextToSize(text, sub ? 130 : 135);
    checkPageBreak((splitValue.length * 5) + 2);

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${label}:`, sub ? 25 : 20, currentY);

    pdf.setFont("helvetica", "normal");
    pdf.text(splitValue, 75, currentY);
    currentY += (splitValue.length * 5) + 2;
  };

  const renderFullRecord = (pdf: jsPDF): void => {
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("CARTELLA SANITARIA E DI RISCHIO", 105, 20, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text("(Art. 41 D.Lgs. 81/08 e s.m.i. - Allegato 3A)", 105, 26, { align: 'center' });
    currentY = 35;

    // SEZIONE 1 — DATI VISITA
    addSectionTitle(pdf, "1. DATI VISITA");
    addKeyValue(pdf, "Data Visita", visit.data_visita);
    addKeyValue(pdf, "Tipo Visita", visit.tipo_visita?.toUpperCase());
    addKeyValue(pdf, "Periodicità", "Annuale (o secondo protocollo sanitario)");

    // SEZIONE 2 — DATI AZIENDA
    addSectionTitle(pdf, "2. DATI AZIENDA");
    addKeyValue(pdf, "Ragione Sociale", company.ragione_sociale);
    addKeyValue(pdf, "Unità Produttiva", company.sede_operativa || "Sede Legale");
    addKeyValue(pdf, "Indirizzo", company.sede_legale);
    addKeyValue(pdf, "Attività Svolta", company.ateco || "Non specificata");

    // SEZIONE 3 — ANAGRAFICA LAVORATORE
    addSectionTitle(pdf, "3. ANAGRAFICA LAVORATORE");
    addKeyValue(pdf, "Nominativo", `${worker.cognome} ${worker.nome}`);
    addKeyValue(pdf, "Data e Luogo Nascita", `${worker.data_nascita} (${worker.luogo_nascita || 'N/D'})`);
    addKeyValue(pdf, "Età", calculateAge(worker.data_nascita));
    addKeyValue(pdf, "Codice Fiscale", worker.codice_fiscale);
    addKeyValue(pdf, "Sesso", worker.sesso);
    addKeyValue(pdf, "Gruppo Sanguigno", "N/D");
    addKeyValue(pdf, "Nazionalità", "Italiana");
    addKeyValue(pdf, "Domicilio / Email", worker.email);

    // SEZIONE 4 — DATI OCCUPAZIONALI
    addSectionTitle(pdf, "4. DATI OCCUPAZIONALI");
    addKeyValue(pdf, "Mansione", effectiveMansione);
    addKeyValue(pdf, "Qualifica", effectiveMansione);
    addKeyValue(pdf, "Reparto", "Operativo");
    addKeyValue(pdf, "Data Assunzione", worker.data_assunzione);
    addKeyValue(pdf, "Data Attuale Mansione", worker.data_assunzione);

    // SEZIONE 5 — FATTORI DI RISCHIO
    addSectionTitle(pdf, "5. FATTORI DI RISCHIO");
    addKeyValue(pdf, "Rischi Protocollo", risks.join(", ") || "Nessun rischio specifico");
    addKeyValue(pdf, "Accertamenti Previsti", "Visita medica ed esami strumentali come da protocollo");

    // SEZIONE 6 — ANAMNESI LAVORATIVA
    addSectionTitle(pdf, "6. ANAMNESI LAVORATIVA");
    if (workHistory.esperienze && workHistory.esperienze.length > 0) {
      workHistory.esperienze.forEach((exp, i) => {
        addKeyValue(pdf, `Esperienza ${i+1}`, `${exp.azienda} (${exp.dal}-${exp.al}) - ${exp.mansione} [Rischi: ${exp.esposizioni.join(", ")}]`, true);
      });
      const cumulativeCounts: Record<string, number> = {};
      workHistory.esperienze.forEach(exp => {
        const start = parseInt(exp.dal);
        const end = exp.al === 'attuale' ? new Date().getFullYear() : parseInt(exp.al);
        if (!isNaN(start) && !isNaN(end)) {
          const years = Math.max(1, end - start);
          exp.esposizioni.forEach(r => cumulativeCounts[r] = (cumulativeCounts[r] || 0) + years);
        }
      });
      const cumulativeText = Object.entries(cumulativeCounts).map(([r, y]) => `${r}: ${y}y`).join(" | ");
      addKeyValue(pdf, "Esposizioni Cumulative", cumulativeText || "Nessuna");
    } else {
      addKeyValue(pdf, "Esperienze Pregresse", "Nessuna registrata");
    }
    addKeyValue(pdf, "Infortuni sul lavoro", workHistory.infortuni === 'Sì' ? `${workHistory.infortuni_n} eventi (ultimo ${workHistory.infortuni_ultimo_anno} - ${workHistory.infortuni_tipo})` : "Nessuno");
    addKeyValue(pdf, "Malattie Professionali", workHistory.malattie_professionali === 'Sì' ? `${workHistory.malattie_professionali_quale} (${workHistory.malattie_professionali_anno})` : "No");

    // SEZIONE 7 — ANAMNESI FAMILIARE
    addSectionTitle(pdf, "7. ANAMNESI FAMILIARE");
    Object.entries(familyHistory).forEach(([member, data]) => {
      const label = member.replace('_', ' ').charAt(0).toUpperCase() + member.replace('_', ' ').slice(1);
      const content = data.patologie.length > 0 || data.deceduto
        ? `${data.deceduto ? 'Deceduto' : 'Vivente'}. Patologie: ${data.patologie.join(", ") || 'Nessuna'} ${data.altro_note ? '(' + data.altro_note + ')' : ''}`
        : "Nulla da segnalare";
      addKeyValue(pdf, label, content);
    });

    // SEZIONE 8 — ANAMNESI FISIOLOGICA
    addSectionTitle(pdf, "8. ANAMNESI FISIOLOGICA");
    addKeyValue(pdf, "Sviluppo Infantile", `Gravidanza: ${physioHistory.sviluppo.gravidanza_parto}. Psicomotorio: ${physioHistory.sviluppo.psicomotorio}`);
    addKeyValue(pdf, "Fumo", physioHistory.abitudini.fumo === 'Fumatore' ? `Sì (${physioHistory.abitudini.fumo_sigarette_die} sig/die x ${physioHistory.abitudini.fumo_anni}y)` : physioHistory.abitudini.fumo);
    addKeyValue(pdf, "Alcol", physioHistory.abitudini.alcol === 'Quotidiano' ? `Sì (${physioHistory.abitudini.alcol_unita_die} unità/die)` : physioHistory.abitudini.alcol);
    addKeyValue(pdf, "Attività Fisica", physioHistory.abitudini.attivita_fisica);
    addKeyValue(pdf, "Dieta / Sonno", `${physioHistory.abitudini.dieta} / Qualità sonno: ${physioHistory.sonno.qualita}`);
    addKeyValue(pdf, "Farmaci Abituali", physioHistory.abitudini.farmaci_abituali || "Nessuno");
    addKeyValue(pdf, "Allergie", physioHistory.abitudini.nessuna_allergia ? "Nessuna nota" : physioHistory.abitudini.allergie_note);

    // SEZIONE 9 — ANAMNESI PATOLOGICA
    addSectionTitle(pdf, "9. ANAMNESI PATOLOGICA");
    addKeyValue(pdf, "Storia Clinica", visit.anamnesi_patologica || "Negativa");

    // SEZIONE 10 — ESAME OBIETTIVO
    const vitalParams = `H: ${visit.altezza}cm | P: ${visit.peso}kg | BMI: ${visit.bmi} | PA: ${visit.p_sistolica}/${visit.p_diastolica} mmHg | FC: ${visit.frequenza} bpm`;
    addKeyValue(pdf, "Parametri Vitali", vitalParams);
    addKeyValue(pdf, "App. Cardiovascolare", `Toni ${visit.eo_toni_puri ? 'puri' : 'impuri'}, ${visit.eo_toni_ritmici ? 'ritmici' : 'aritmici'}. Varici: ${visit.eo_varici ? 'Presenti' : 'Assenti'}`);
    addKeyValue(pdf, "App. Digerente", `Addome ${visit.eo_addome_piano ? 'piano' : 'globoso'}, ${visit.eo_trattabile ? 'trattabile' : 'non trattabile'}`);
    addKeyValue(pdf, "App. Urogenitale", `Giordano DX: ${visit.eo_giordano_dx}, SX: ${visit.eo_giordano_sx}`);
    addKeyValue(pdf, "App. Respiratorio", visit.eo_pless_norma ? "Nella norma" : "Alterato");
    addKeyValue(pdf, "Sist. Nervoso", `Test Tinel: ${visit.eo_tinel}. Test Phalen: ${visit.eo_phalen}`);
    addKeyValue(pdf, "App. Osteoarticolare", `Lasègue DX: ${visit.eo_lasegue_dx}, SX: ${visit.eo_lasegue_sx}. Paravertebrali: ${visit.eo_palpazione_paravertebrali}. Rachide: Rot. ${visit.eo_rachide_rotazione}, Incl. ${visit.eo_rachide_inclinazione}, Flex. ${visit.eo_rachide_flessoestensione}`);
    addKeyValue(pdf, "Visus e Udito", `Visus Nat. (OS/OD): ${visit.eo_visus_nat_os}/${visit.eo_visus_nat_od}. Udito ridotto: ${visit.eo_udito_ridotto ? 'Sì' : 'No'}`);
    if (visit.eo_note) addKeyValue(pdf, "Note EO", visit.eo_note);

    // SEZIONE 11 — ACCERTAMENTI INTEGRATIVI
    addSectionTitle(pdf, "11. ACCERTAMENTI INTEGRATIVI");
    addKeyValue(pdf, "Laboratorio", "Esami ematochimici standard");
    addKeyValue(pdf, "Strumentali", "Audiometria, Spirometria");
    addKeyValue(pdf, "Tossicologici", "Drug Test (dove previsto)");
    addKeyValue(pdf, "Esiti Complessivi", visit.accertamenti_effettuati || "Nessun accertamento integrativo eseguito");

    // SEZIONE 12 — CONCLUSIONI E GIUDIZIO
    addSectionTitle(pdf, "12. CONCLUSIONI E GIUDIZIO");
    addKeyValue(pdf, "Conclusioni", "Si rimanda al giudizio di idoneità");
    addKeyValue(pdf, "Giudizio Finale", visit.giudizio?.toUpperCase());
    addKeyValue(pdf, "Prescrizioni", visit.prescrizioni || "Nessuna prescrizione o limitazione");
    addKeyValue(pdf, "Prossima Visita", visit.scadenza_prossima);

    // SEZIONE 13 — TRASMISSIONE
    addSectionTitle(pdf, "13. TRASMISSIONE");
    addKeyValue(pdf, "Al Lavoratore", `${visit.trasmissione_lavoratore_data || 'Data odierna'} via ${visit.trasmissione_lavoratore_metodo || 'Consegna diretta'}`);
    addKeyValue(pdf, "Al Datore", `${visit.trasmissione_datore_data || 'Entro termini di legge'} via ${visit.trasmissione_datore_metodo || 'PEC'}`);

    // SEZIONE 14 — FIRME
    addSectionTitle(pdf, "14. FIRME");
    checkPageBreak(40);
    pdf.setFontSize(9);
    pdf.text("Firma del Lavoratore (per presa visione e copia)", 20, currentY + 15);
    pdf.line(20, currentY + 10, 80, currentY + 10);

    const drSignatureName = doctor.nome || "____________________";
    pdf.text(`Firma Medico Competente (Dott. ${drSignatureName})`, 130, currentY + 15);
    pdf.line(130, currentY + 10, 190, currentY + 10);
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

    const drSignatureName = doctor.nome || "____________________";
    pdf.text(`Firma Medico Competente (Dott. ${drSignatureName})`, 130, currentY + 10);
    pdf.line(130, currentY + 5, 190, currentY + 5);
  };

  // Main Logic Execution
  if (mode === 'full' || mode === 'combined') {
    renderFullRecord(doc);
  }

  if (mode === 'combined') {
    doc.addPage();
    currentY = 25;
    renderJudgmentOnly(doc);
  } else if (mode === 'judgment') {
    renderJudgmentOnly(doc);
  }

  // Post-processing Header/Footer to ALL pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    addHeader(doc, i);
    addFooter(doc, i, totalPages);
  }

  const filename = mode === 'judgment' ? `Giudizio_${worker.cognome}.pdf` : `Cartella_3A_${worker.cognome}.pdf`;
  doc.save(filename);
  return doc;
};
