import { jsPDF } from 'jspdf';

export interface Worker {
  id: number;
  nome: string;
  cognome: string;
  codice_fiscale?: string;
  email?: string;
  mansione?: string;
  azienda: string;
}

export interface Visit {
  data_visita: string;
  tipo_visita: string;
  anamnesi_lavorativa: string;
  anamnesi_familiare: string;
  anamnesi_patologica: string;
  accertamenti_effettuati: string;
  eo_cardiaca: string;
  eo_respiratoria: string;
  eo_cervicale: string;
  eo_dorsolombare: string;
  eo_spalle: string;
  eo_arti_superiori: string;
  eo_arti_inferiori: string;
  eo_altro: string;
  giudizio: string;
  prescrizioni: string;
  scadenza_prossima: string;
  peso: number;
  altezza: number;
  p_sistolica: number;
  p_diastolica: number;
  frequenza: number;
  spo2: number;
}

export interface DoctorProfile {
  nome: string;
  specializzazione: string;
  n_iscrizione: string;
}

const addHeader = (doc: jsPDF, title: string, subTitle?: string) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 105, 20, { align: 'center' });
  if (subTitle) {
    doc.setFontSize(10);
    doc.text(subTitle, 105, 26, { align: 'center' });
  }
};

const addFooter = (doc: jsPDF, doctor: DoctorProfile) => {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Documento generato ai sensi del D.Lgs. 81/08 - Pagina ${i} di ${pageCount}`, 105, 285, { align: 'center' });
    doc.text(`Medico Competente: Dott. ${doctor.nome || '________________'}`, 20, 285);
  }
};

const addDoctorSignature = (doc: jsPDF, doctor: DoctorProfile, y: number) => {
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Dott. ${doctor.nome || '____________________'}`, 130, y);
  doc.text(`Spec. ${doctor.specializzazione || '____________________'}`, 130, y + 6);
  doc.text(`N. Iscr. ${doctor.n_iscrizione || '_______'}`, 130, y + 12);
  doc.line(130, y + 14, 190, y + 14);
  doc.text("Firma del Medico Competente", 135, y + 19);
};

export const generateGiudizio = (doc: jsPDF, worker: Worker, visit: Visit, doctor: DoctorProfile, startY: number = 0) => {
  if (startY === 0) {
    addHeader(doc, "GIUDIZIO DI IDONEITÀ ALLA MANSIONE SPECIFICA", "(D.Lgs. 81/08 e s.m.i. - Art. 41)");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("GIUDIZIO DI IDONEITÀ ALLA MANSIONE SPECIFICA", 105, startY + 10, { align: 'center' });
    startY += 15;
  }

  const y = startY === 0 ? 35 : startY;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.rect(15, y, 180, 45);
  doc.text(`Lavoratore: ${worker.cognome} ${worker.nome}`, 20, y + 10);
  doc.text(`Codice Fiscale: ${worker.codice_fiscale || 'N/D'}`, 20, y + 16);
  doc.text(`Azienda: ${worker.azienda}`, 20, y + 22);
  doc.text(`Mansione: ${worker.mansione || 'N/D'}`, 20, y + 28);
  doc.text(`Data Visita: ${visit.data_visita}`, 20, y + 34);
  doc.text(`Tipo Visita: ${visit.tipo_visita.toUpperCase()}`, 20, y + 40);

  doc.setFont("helvetica", "bold");
  doc.text("GIUDIZIO:", 20, y + 60);
  doc.setFontSize(14);
  doc.text(visit.giudizio.toUpperCase(), 45, y + 60);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (visit.prescrizioni) {
    doc.text("Prescrizioni/Limitazioni:", 20, y + 70);
    doc.text(visit.prescrizioni, 20, y + 77, { maxWidth: 170 });
  }

  doc.text(`Prossima visita entro il: ${visit.scadenza_prossima}`, 20, y + 110);
  addDoctorSignature(doc, doctor, y + 140);
};

export const generateCartella3A = (doc: jsPDF, worker: Worker, visit: Visit, doctor: DoctorProfile) => {
  addHeader(doc, "CARTELLA SANITARIA E DI RISCHIO", "(Allegato 3A - D.Lgs. 81/08)");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SEZIONE 1: ANAGRAFICA", 15, 40);
  doc.setFont("helvetica", "normal");
  doc.text(`Lavoratore: ${worker.cognome} ${worker.nome}`, 20, 47);
  doc.text(`Azienda: ${worker.azienda} | Mansione: ${worker.mansione || 'N/D'}`, 20, 53);

  doc.setFont("helvetica", "bold");
  doc.text("SEZIONE 2: ANAMNESI", 15, 65);
  doc.setFont("helvetica", "normal");
  doc.text("Lavorativa:", 20, 72);
  doc.text(visit.anamnesi_lavorativa || "Negativa", 25, 78, { maxWidth: 165 });
  doc.text("Patologica/Familiare:", 20, 95);
  doc.text(visit.anamnesi_patologica || "Negativa", 25, 101, { maxWidth: 165 });

  doc.setFont("helvetica", "bold");
  doc.text("SEZIONE 3: PARAMETRI E ESAME OBIETTIVO", 15, 130);
  doc.setFont("helvetica", "normal");
  const bmi = (visit.peso / ((visit.altezza / 100) ** 2)).toFixed(1);
  doc.text(`Peso: ${visit.peso}kg | Altezza: ${visit.altezza}cm | BMI: ${bmi}`, 20, 137);
  doc.text(`PA: ${visit.p_sistolica}/${visit.p_diastolica} mmHg | FC: ${visit.frequenza} bpm | SpO2: ${visit.spo2}%`, 20, 143);

  let currentY = 153;
  const addEOField = (label: string, text: string) => {
    if (text) {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 20, currentY);
      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(text, 165);
      doc.text(splitText, 25, currentY + 6);
      currentY += (splitText.length * 5) + 10;
    }
  };

  addEOField("Apparato Cardiovascolare", visit.eo_cardiaca);
  addEOField("Apparato Respiratorio", visit.eo_respiratoria);
  addEOField("Apparato Muscoloscheletrico", [visit.eo_cervicale, visit.eo_dorsolombare, visit.eo_spalle, visit.eo_arti_superiori, visit.eo_arti_inferiori].filter(v => v).join(" | "));
  addEOField("Altro", visit.eo_altro);

  if (visit.accertamenti_effettuati) {
    addEOField("ACCERTAMENTI STRUMENTALI", visit.accertamenti_effettuati);
  }

  addDoctorSignature(doc, doctor, currentY + 10);
};

export const exportPDF = (mode: 'completa' | 'giudizio' | 'entrambi', worker: Worker, visit: Visit, doctor: DoctorProfile) => {
  const doc = new jsPDF();

  if (mode === 'giudizio') {
    generateGiudizio(doc, worker, visit, doctor);
    addFooter(doc, doctor);
    doc.save(`Giudizio_${worker.cognome}_${visit.data_visita}.pdf`);
  } else if (mode === 'completa') {
    generateCartella3A(doc, worker, visit, doctor);
    addFooter(doc, doctor);
    doc.save(`Cartella_3A_${worker.cognome}_${visit.data_visita}.pdf`);
  } else if (mode === 'entrambi') {
    generateCartella3A(doc, worker, visit, doctor);
    doc.addPage();
    generateGiudizio(doc, worker, visit, doctor, 20);
    addFooter(doc, doctor);
    doc.save(`Cartella_e_Giudizio_${worker.cognome}_${visit.data_visita}.pdf`);
  }
};
