import { jsPDF } from 'jspdf';
import { executeQuery } from './db';

// Inline Types to ensure self-contained module
export interface Company {
  id: number;
  ragione_sociale: string;
  p_iva: string;
  codice_fiscale: string;
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
  email: string;
  data_nascita: string;
  luogo_nascita: string;
  sesso: string;
  mansione: string;
  data_assunzione: string;
  rischi: string; // JSON string
  protocol_id?: number;
  is_protocol_customized: boolean;
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
  ateco: string;
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
  anamnesi_lavorativa: string;
  anamnesi_familiare: string;
  anamnesi_patologica: string;
  anamnesi_fisiologica?: string;
  altezza: number;
  peso: number;
  bmi: number;
  p_sistolica: number;
  p_diastolica: number;
  frequenza: number;
  eo_toni_puri: boolean;
  eo_toni_ritmici: boolean;
  eo_varici: boolean;
  eo_addome_piano: boolean;
  eo_trattabile: boolean;
  eo_dolente: boolean;
  eo_fegato_regolare: boolean;
  eo_milza_regolare: boolean;
  eo_giordano_dx: 'Negativa' | 'Positiva';
  eo_giordano_sx: 'Negativa' | 'Positiva';
  eo_pless_norma: boolean;
  eo_ispettivi_norma: boolean;
  eo_tinel: 'Non eseguita' | 'Negativa' | 'Positiva';
  eo_phalen: 'Non eseguita' | 'Negativa' | 'Positiva';
  eo_lasegue_dx: 'Negativa' | 'Positiva';
  eo_lasegue_sx: 'Negativa' | 'Positiva';
  eo_palpazione_paravertebrali: 'Nessun dolore' | 'Dolorabile' | 'Dolente';
  eo_digitopressione_apofisi: 'Nessun dolore' | 'Dolorabile' | 'Dolente';
  eo_rachide_rotazione: 'Nella norma' | 'Lievemente ridotta' | 'Ridotta';
  eo_rachide_inclinazione: 'Nella norma' | 'Lievemente ridotta' | 'Ridotta';
  eo_rachide_flessoestensione: 'Nella norma' | 'Lievemente ridotta' | 'Ridotta';
  eo_visus_nat_os: number;
  eo_visus_nat_od: number;
  eo_visus_corr_os: number;
  eo_visus_corr_od: number;
  eo_udito_ridotto: boolean;
  accertamenti_effettuati: string;
  eo_note: string;
  giudizio: string;
  prescrizioni: string;
  scadenza_prossima: string;
  trasmissione_lavoratore_data?: string;
  trasmissione_lavoratore_metodo?: string;
  trasmissione_datore_data?: string;
  trasmissione_datore_metodo?: string;
}

export interface DoctorProfile {
  id: number;
  nome: string;
  specializzazione: string;
  n_iscrizione: string;
  timbro_immagine?: string;
}

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

  // BUG FIX 2: Dati medico da Settings (doctor_profile) if empty
  let effectiveDoctor = { ...doctor };
  if (!effectiveDoctor.nome || String(effectiveDoctor.nome).trim() === "") {
    const dbDoctor = executeQuery("SELECT * FROM doctor_profile WHERE id = 1");
    if (dbDoctor && dbDoctor.length > 0) {
      effectiveDoctor = dbDoctor[0];
    }
  }

  // BUG FIX 1: Mansione "null" - Leggi dal protocollo se necessario
  let effectiveMansione: string = worker.mansione || "";
  if (!effectiveMansione || String(effectiveMansione).toLowerCase() === "null" || String(effectiveMansione).trim() === "") {
    if (worker.protocol_id) {
      const proto = executeQuery("SELECT mansione FROM protocols WHERE id = ?", [worker.protocol_id]);
      if (proto && proto.length > 0 && proto[0].mansione) {
        effectiveMansione = String(proto[0].mansione);
      }
    }
  }
  if (!effectiveMansione || String(effectiveMansione).toLowerCase() === "null") effectiveMansione = "Non rilevato";

  const calculateAge = (dob: string): string => {
    if (!dob) return "Non rilevato";
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return "Non rilevato";
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

  // HEADER: Nome medico e data visita su ogni pagina
  const addHeader = (pdf: jsPDF, pageIndex: number): void => {
    pdf.setPage(pageIndex);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");

    const drName = effectiveDoctor.nome || "Non rilevato";
    const drSpec = effectiveDoctor.specializzazione || "Non rilevato";
    const drIscr = effectiveDoctor.n_iscrizione || "Non rilevato";
    const visitDate = visit.data_visita || "Non rilevato";

    pdf.text(`Dott. ${drName} | ${drSpec} | Iscr. Ordine ${drIscr}`, 15, 10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Data Visita: ${visitDate}`, 195, 10, { align: 'right' });
    pdf.line(15, 12, 195, 12);
  };

  // FOOTER: Documento riservato + Pagina X di Y
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

    // 3. Regola universale per tutti i campi
    if (value === true) {
      if (label.includes("App.") || label.includes("Sist.") || label.includes("Toni") || label.includes("Esame") || label.includes("norma")) {
        text = "Nella norma";
      } else {
        text = "Sì / Presente";
      }
    } else if (value === false) {
      if (label.includes("App.") || label.includes("Sist.") || label.includes("Toni")) {
        text = "Alterato"; // Or something specific, but let's stick to the rule logic
      } else {
        text = "No / Assente";
      }
    } else if (value !== undefined && value !== null && String(value).trim() !== "" && String(value).toLowerCase() !== "null") {
      text = String(value);
    }

    // Context-aware defaults based on User instructions
    if (text === "Non rilevato") {
      if (label.includes("Anamnesi") || label.includes("familiare") || label.includes("storia") || label.includes("Pregresse")) {
        text = "Nulla da segnalare";
      }
      if (label.includes("App.") || label.includes("Sist.") || label.includes("Giordano") || label.includes("Esame") || label.includes("Toni") || label.includes("Visus") || label.includes("EO")) {
        text = "Non esaminato";
      }
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

    addSectionTitle(pdf, "1. DATI VISITA");
    addKeyValue(pdf, "Data Visita", visit.data_visita);
    addKeyValue(pdf, "Tipo Visita", visit.tipo_visita?.toUpperCase());
    addKeyValue(pdf, "Periodicità", "Annuale (o secondo protocollo sanitario)");

    addSectionTitle(pdf, "2. DATI AZIENDA");
    addKeyValue(pdf, "Ragione Sociale", company.ragione_sociale);
    addKeyValue(pdf, "Unità Produttiva", company.sede_operativa);
    addKeyValue(pdf, "Indirizzo", company.sede_legale);
    addKeyValue(pdf, "Attività Svolta", company.ateco);

    addSectionTitle(pdf, "3. ANAGRAFICA LAVORATORE");
    addKeyValue(pdf, "Nominativo", `${worker.cognome || ''} ${worker.nome || ''}`.trim() || null);
    const birthInfo = worker.data_nascita ? `${worker.data_nascita} (${worker.luogo_nascita || 'Non rilevato'})` : null;
    addKeyValue(pdf, "Data e Luogo Nascita", birthInfo);
    addKeyValue(pdf, "Età", calculateAge(worker.data_nascita));
    addKeyValue(pdf, "Codice Fiscale", worker.codice_fiscale);
    addKeyValue(pdf, "Sesso", worker.sesso);
    addKeyValue(pdf, "Gruppo Sanguigno", null);
    addKeyValue(pdf, "Nazionalità", "Italiana");
    addKeyValue(pdf, "Domicilio / Email", worker.email);

    addSectionTitle(pdf, "4. DATI OCCUPAZIONALI");
    addKeyValue(pdf, "Mansione", effectiveMansione);
    addKeyValue(pdf, "Qualifica", effectiveMansione);
    addKeyValue(pdf, "Reparto", "Operativo");
    addKeyValue(pdf, "Data Assunzione", worker.data_assunzione);
    addKeyValue(pdf, "Data Attuale Mansione", worker.data_assunzione);

    addSectionTitle(pdf, "5. FATTORI DI RISCHIO");
    addKeyValue(pdf, "Rischi Protocollo", risks.join(", "));
    addKeyValue(pdf, "Accertamenti Previsti", "Visita medica ed esami strumentali come da protocollo");

    addSectionTitle(pdf, "6. ANAMNESI PATOLOGICA");
    addKeyValue(pdf, "Storia Clinica", visit.anamnesi_patologica);

    addSectionTitle(pdf, "7. PARAMETRI VITALI");
    const hasVitals = visit.altezza || visit.peso || visit.p_sistolica;
    const vitalParams = hasVitals ? `H: ${visit.altezza || 'N/D'}cm | P: ${visit.peso || 'N/D'}kg | BMI: ${visit.bmi || 'N/D'} | PA: ${visit.p_sistolica || 'N/D'}/${visit.p_diastolica || 'N/D'} mmHg | FC: ${visit.frequenza || 'N/D'} bpm` : null;
    addKeyValue(pdf, "Parametri Vitali", vitalParams);

    addSectionTitle(pdf, "8. ESAME OBIETTIVO");
    const cardioText = visit.eo_toni_puri !== undefined ? `Toni ${visit.eo_toni_puri ? 'puri' : 'impuri'}, ${visit.eo_toni_ritmici ? 'ritmici' : 'aritmici'}. Varici: ${visit.eo_varici ? 'Presenti' : 'Assenti'}` : null;
    const digerenteText = visit.eo_addome_piano !== undefined ? `Addome ${visit.eo_addome_piano ? 'piano' : 'globoso'}, ${visit.eo_trattabile ? 'trattabile' : 'non trattabile'}` : null;
    const urogenitaleText = visit.eo_giordano_dx !== undefined ? `Giordano DX: ${visit.eo_giordano_dx}, SX: ${visit.eo_giordano_sx}` : null;
    const respiratorioText = visit.eo_pless_norma !== undefined ? (visit.eo_pless_norma ? "Nella norma" : "Alterato") : null;
    const nervosoText = visit.eo_tinel !== undefined ? `Test Tinel: ${visit.eo_tinel}. Test Phalen: ${visit.eo_phalen}` : null;
    const osteoText = visit.eo_lasegue_dx !== undefined ? `Lasègue DX: ${visit.eo_lasegue_dx}, SX: ${visit.eo_lasegue_sx}. Paravertebrali: ${visit.eo_palpazione_paravertebrali}. Rachide: Rot. ${visit.eo_rachide_rotazione}, Incl. ${visit.eo_rachide_inclinazione}, Flex. ${visit.eo_rachide_flessoestensione}` : null;
    const visusText = (visit.eo_visus_nat_os !== undefined || visit.eo_udito_ridotto !== undefined) ? `Visus Nat. (OS/OD): ${visit.eo_visus_nat_os || 0}/${visit.eo_visus_nat_od || 0}. Udito ridotto: ${visit.eo_udito_ridotto ? 'Sì' : 'No'}` : null;

    addKeyValue(pdf, "App. Cardiovascolare", cardioText);
    addKeyValue(pdf, "App. Digerente", digerenteText);
    addKeyValue(pdf, "App. Urogenitale", urogenitaleText);
    addKeyValue(pdf, "App. Respiratorio", respiratorioText);
    addKeyValue(pdf, "Sist. Nervoso", nervosoText);
    addKeyValue(pdf, "App. Osteoarticolare", osteoText);
    addKeyValue(pdf, "Visus e Udito", visusText);
    addKeyValue(pdf, "Note EO", visit.eo_note);

    addSectionTitle(pdf, "9. ANAMNESI FAMILIARE");
    if (familyHistory && Object.keys(familyHistory).length > 0) {
      Object.entries(familyHistory).forEach(([member, data]) => {
        const label = member.replace('_', ' ').charAt(0).toUpperCase() + member.replace('_', ' ').slice(1);
        const content = data.patologie.length > 0 || data.deceduto
          ? `${data.deceduto ? 'Deceduto' : 'Vivente'}. Patologie: ${data.patologie.join(", ") || 'Nessuna'} ${data.altro_note ? '(' + data.altro_note + ')' : ''}`
          : "Nulla da segnalare";
        addKeyValue(pdf, label, content);
      });
    } else {
      addKeyValue(pdf, "Anamnesi familiare", null, false); // Will fallback to "Nulla da segnalare"
    }

    addSectionTitle(pdf, "10. ANAMNESI FISIOLOGICA COMPLETA");
    if (physioHistory && physioHistory.sviluppo) {
      addKeyValue(pdf, "Sviluppo Infantile", `Gravidanza: ${physioHistory.sviluppo.gravidanza_parto || 'Non rilevato'}. Psicomotorio: ${physioHistory.sviluppo.psicomotorio || 'Non rilevato'}`);
      addKeyValue(pdf, "Fumo", physioHistory.abitudini.fumo === 'Fumatore' ? `Sì (${physioHistory.abitudini.fumo_sigarette_die || 0} sig/die x ${physioHistory.abitudini.fumo_anni || 0}y)` : (physioHistory.abitudini.fumo || 'Non rilevato'));
      addKeyValue(pdf, "Alcol", physioHistory.abitudini.alcol === 'Quotidiano' ? `Sì (${physioHistory.abitudini.alcol_unita_die || 0} unità/die)` : (physioHistory.abitudini.alcol || 'Non rilevato'));
      addKeyValue(pdf, "Attività Fisica", physioHistory.abitudini.attivita_fisica);
      addKeyValue(pdf, "Dieta / Sonno", `${physioHistory.abitudini.dieta || 'Non rilevato'} / Qualità sonno: ${physioHistory.sonno.qualita || 'Non rilevato'}`);
      addKeyValue(pdf, "Farmaci Abituali", physioHistory.abitudini.farmaci_abituali);
      addKeyValue(pdf, "Allergie", physioHistory.abitudini.nessuna_allergia ? "Nessuna nota" : (physioHistory.abitudini.allergie_note || 'Nulla da segnalare'));
    } else {
      addKeyValue(pdf, "Anamnesi fisiologica", null);
    }

    addSectionTitle(pdf, "11. ANAMNESI LAVORATIVA CON TIMELINE");
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
      addKeyValue(pdf, "Esposizioni Cumulative", cumulativeText);
    } else {
      addKeyValue(pdf, "Esperienze Pregresse", null);
    }
    addKeyValue(pdf, "Infortuni sul lavoro", workHistory.infortuni === 'Sì' ? `${workHistory.infortuni_n} eventi (ultimo ${workHistory.infortuni_ultimo_anno} - ${workHistory.infortuni_tipo})` : "Nessuno");
    addKeyValue(pdf, "Malattie Professionali", workHistory.malattie_professionali === 'Sì' ? `${workHistory.malattie_professionali_quale} (${workHistory.malattie_professionali_anno})` : "No");

    addSectionTitle(pdf, "12. ACCERTAMENTI INTEGRATIVI CON ESITI");
    addKeyValue(pdf, "Laboratorio", "Esami ematochimici standard");
    addKeyValue(pdf, "Strumentali", "Audiometria, Spirometria");
    addKeyValue(pdf, "Tossicologici", "Drug Test (dove previsto)");
    addKeyValue(pdf, "Esiti Complessivi", visit.accertamenti_effettuati);

    addSectionTitle(pdf, "13. TRASMISSIONE DOCUMENTI");
    addKeyValue(pdf, "Al Lavoratore", visit.trasmissione_lavoratore_data ? `${visit.trasmissione_lavoratore_data} via ${visit.trasmissione_lavoratore_metodo || 'Consegna diretta'}` : null);
    addKeyValue(pdf, "Al Datore", visit.trasmissione_datore_data ? `${visit.trasmissione_datore_data} via ${visit.trasmissione_datore_metodo || 'PEC'}` : null);

    addSectionTitle(pdf, "14. CONCLUSIONI E GIUDIZIO");
    addKeyValue(pdf, "Conclusioni", "Si rimanda al giudizio di idoneità");
    addKeyValue(pdf, "Giudizio Finale", visit.giudizio ? visit.giudizio.toUpperCase() : null);
    addKeyValue(pdf, "Prescrizioni", visit.prescrizioni);
    addKeyValue(pdf, "Prossima Visita", visit.scadenza_prossima);

    addSectionTitle(pdf, "15. FIRME");
    checkPageBreak(40);
    pdf.setFontSize(9);
    pdf.text("Firma del Lavoratore (per presa visione e copia)", 20, currentY + 15);
    pdf.line(20, currentY + 10, 80, currentY + 10);

    const drSignatureName = effectiveDoctor.nome || "____________________";
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
    pdf.text(`Lavoratore: ${worker.cognome || 'Non rilevato'} ${worker.nome || 'Non rilevato'}`, 20, currentY + 10);
    pdf.text(`Codice Fiscale: ${worker.codice_fiscale || 'Non rilevato'}`, 20, currentY + 18);
    pdf.text(`Azienda: ${company.ragione_sociale || 'Non rilevato'}`, 20, currentY + 26);
    pdf.text(`Mansione: ${effectiveMansione || 'Non rilevato'}`, 20, currentY + 34);
    pdf.text(`Data Visita: ${visit.data_visita || 'Non rilevato'}`, 20, currentY + 42);

    currentY += 65;
    pdf.setFontSize(12);
    pdf.text("ESITO DELLA SORVEGLIANZA SANITARIA:", 15, currentY);
    currentY += 10;
    pdf.setFontSize(18);
    pdf.text((visit.giudizio || 'Non rilevato').toUpperCase(), 105, currentY + 5, { align: 'center' });

    currentY += 25;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("PRESCRIZIONI / LIMITAZIONI / SUGGERIMENTI:", 15, currentY);
    pdf.setFont("helvetica", "normal");
    const presc = pdf.splitTextToSize(visit.prescrizioni || "Nulla da segnalare", 175);
    pdf.text(presc, 15, currentY + 8);

    currentY += 40;
    pdf.text(`Data prossima visita entro il: ${visit.scadenza_prossima || 'Non rilevato'}`, 15, currentY);

    currentY += 30;
    pdf.text("Firma del Lavoratore", 20, currentY + 10);
    pdf.line(20, currentY + 5, 80, currentY + 5);

    const drSignatureName = effectiveDoctor.nome || "____________________";
    pdf.text(`Firma Medico Competente (Dott. ${drSignatureName})`, 130, currentY + 10);
    pdf.line(130, currentY + 5, 190, currentY + 5);
  };

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

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    addHeader(doc, i);
    addFooter(doc, i, totalPages);
  }

  return doc;
};
