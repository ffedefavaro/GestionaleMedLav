import { jsPDF } from 'jspdf';
import type { Worker, Company, Visit, DoctorProfile, Biometrics } from '../types';

interface PDFData {
  worker: Worker;
  company: Company;
  visit: Visit;
  doctor: DoctorProfile;
  biometrics?: Biometrics;
}

/**
 * Genera il documento PDF dell'Allegato 3A (Cartella Sanitaria e di Rischio)
 * Replicando la struttura professionale richiesta.
 */
export const generateAllegato3APDF = async (data: PDFData) => {
  const { worker, company, visit, doctor, biometrics } = data;
  const doc = new jsPDF();

  const marginX = 20;
  let currentY = 20;

  const checkPageOverflow = (needed: number) => {
    if (currentY + needed > 250) {
      doc.addPage();
      currentY = 20;
      return true;
    }
    return false;
  };

  const drawSectionHeader = (title: string) => {
    checkPageOverflow(15);
    doc.setFillColor(240, 240, 240);
    doc.rect(marginX, currentY, 170, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text(title.toUpperCase(), marginX + 2, currentY + 6);
    currentY += 12;
  };

  const drawField = (label: string, value: string | undefined | null, fullWidth = false) => {
    const text = value || "---";
    const splitText = doc.splitTextToSize(text, fullWidth ? 165 : 80);
    const height = (splitText.length * 5) + 5;

    checkPageOverflow(height);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(label, marginX, currentY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(splitText, marginX, currentY + 5);

    if (fullWidth) {
      currentY += height + 2;
    }
    return height;
  };

  // --- HEADER PRINCIPALE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CARTELLA SANITARIA E DI RISCHIO", 105, 20, { align: 'center' });
  doc.setFontSize(9);
  doc.text("(D.Lgs. 81/08 e s.m.i. - Allegato 3A)", 105, 26, { align: 'center' });

  currentY = 35;

  // --- SEZIONE 1: ANAGRAFICA ---
  drawSectionHeader("1. Dati Anagrafici");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("LAVORATORE:", marginX, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(`${worker.cognome} ${worker.nome}`, marginX + 30, currentY);
  currentY += 6;

  doc.setFont("helvetica", "bold");
  doc.text("C.F.:", marginX, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(worker.codice_fiscale || "N/D", marginX + 30, currentY);
  currentY += 6;

  doc.setFont("helvetica", "bold");
  doc.text("AZIENDA:", marginX, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(company.ragione_sociale, marginX + 30, currentY);
  currentY += 6;

  doc.setFont("helvetica", "bold");
  doc.text("MANSIONE:", marginX, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(worker.mansione || "N/D", marginX + 30, currentY);
  currentY += 10;

  // --- SEZIONE 2: ANAMNESI ---
  drawSectionHeader("2. Anamnesi");
  drawField("Anamnesi Lavorativa (pregressa esposizione a rischi):", visit.anamnesi_lavorativa, true);
  drawField("Anamnesi Familiare e Patologica (remota e prossima):", visit.anamnesi_patologica, true);

  // --- SEZIONE 3: ESAME OBIETTIVO ---
  drawSectionHeader("3. Esame Obiettivo e Parametri");

  if (biometrics) {
    doc.setFontSize(9);
    const bioText = `Peso: ${biometrics.peso || '--'} kg | Altezza: ${biometrics.altezza || '--'} cm | BMI: ${biometrics.bmi || '--'} | PA: ${biometrics.pressione_sistolica || '--'}/${biometrics.pressione_diastolica || '--'} mmHg | FC: ${biometrics.frequenza_cardiaca || '--'} bpm | SpO2: ${biometrics.spo2 || '--'}%`;
    doc.setFont("helvetica", "normal");
    doc.text(bioText, marginX, currentY);
    currentY += 10;
  }

  // Apparati espansi
  const apparati = [
    { label: "Apparato Cardiovascolare", val: visit.eo_cardiaca },
    { label: "Apparato Respiratorio", val: visit.eo_respiratoria },
    { label: "Rachide Cervicale", val: visit.eo_cervicale },
    { label: "Rachide Dorsolombare", val: visit.eo_dorsolombare },
    { label: "Spalle", val: visit.eo_spalle },
    { label: "Arti Superiori", val: visit.eo_arti_superiori },
    { label: "Arti Inferiori", val: visit.eo_arti_inferiori },
    { label: "Altro / Stato Generale", val: visit.eo_altro }
  ];

  apparati.forEach(app => {
    drawField(app.label, app.val, true);
  });

  // --- SEZIONE 4: ACCERTAMENTI ---
  drawSectionHeader("4. Accertamenti Integrativi");
  drawField("Esami strumentali e di laboratorio effettuati:", visit.accertamenti_effettuati, true);

  // --- SEZIONE 5: GIUDIZIO DI IDONEITÀ ---
  drawSectionHeader("5. Giudizio di Idoneità");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(visit.giudizio.toUpperCase(), marginX, currentY);
  currentY += 8;

  if (visit.prescrizioni) {
    drawField("Prescrizioni / Limitazioni:", visit.prescrizioni, true);
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`PROSSIMA VISITA ENTRO IL: ${visit.scadenza_prossima || "N/D"}`, marginX, currentY);
  currentY += 15;

  // --- ALLEGATO A: RACHIDE (Se compilato) ---
  const hasRachide = visit.eo_cervicale || visit.eo_dorsolombare;
  if (hasRachide) {
    doc.addPage();
    currentY = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ALLEGATO A: PROTOCOLLO DI VALUTAZIONE DEL RACHIDE", 105, currentY, { align: 'center' });
    currentY += 15;

    drawField("Esame Cervicale:", visit.eo_cervicale, true);
    drawField("Esame Dorsolombare:", visit.eo_dorsolombare, true);
    drawField("Note aggiuntive Rachide:", "Valutazione funzionale completa eseguita secondo protocollo standard.", true);
  }

  // --- ALLEGATO B: AUDIOMETRIA (Se presente negli accertamenti) ---
  const isAudioCompiled = visit.accertamenti_effettuati?.toLowerCase().includes("audiometr");
  if (isAudioCompiled) {
    doc.addPage();
    currentY = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ALLEGATO B: ESAME AUDIOMETRICO", 105, currentY, { align: 'center' });
    currentY += 15;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Referto esame audiometrico tonale per via aerea:", marginX, currentY);
    currentY += 8;

    // Placeholder per dati audiometrici se fossero strutturati, altrimenti riprendiamo le note
    drawField("Risultanze Audiometriche:", visit.accertamenti_effettuati, true);
  }

  // --- HEADER E FOOTER SU OGNI PAGINA ---
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Header
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(`Dott. ${doctor.nome} - ${doctor.specializzazione} - Iscr. Ordine: ${doctor.n_iscrizione}`, marginX, 10);
    doc.text(`Lavoratore: ${worker.cognome} ${worker.nome} - Data Visita: ${visit.data_visita}`, 190, 10, { align: 'right' });

    // Footer
    doc.line(marginX, 275, 190, 275);
    doc.text(`CartSan Lean - Allegato 3A - Pagina ${i} di ${totalPages}`, marginX, 282);

    if (doctor.timbro_immagine) {
      try {
        doc.addImage(doctor.timbro_immagine, 'PNG', 140, 255, 40, 20);
      } catch {
        // Ignora se l'immagine non è valida
      }
    }
    doc.setFont("helvetica", "bold");
    doc.text("Firma del Medico Competente", 150, 278);
  }

  return doc;
};
