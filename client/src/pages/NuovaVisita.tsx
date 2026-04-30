import { useState, useEffect, useMemo } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import {
  Activity, CheckCircle, Download,
  Heart, Wind, Stethoscope, Shield, User as UserIcon,
  PenTool, FileText, ChevronRight, ChevronLeft, AlertCircle, Clock, MapPin, Phone, Droplets, Briefcase, Calendar
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import WorkerSearch from '../components/WorkerSearch';
import { SignatureInput } from '../components/visita/SignatureInput';

// --- INITIAL STATE ---
const INITIAL_VISIT_STATE = {
  sezione1: {
    data_visita: new Date().toISOString().split('T')[0],
    periodicita: 'Annuale', // Annuale / Biennale / Straordinaria / Su richiesta
    tipo_visita: 'Periodica' // Preventiva / Periodica / Su richiesta / Cambio mansione / Ripresa lavoro / A richiesta lavoratore
  },
  sezione5: { // Programma Sorveglianza
    rischi: {
      mmc: { active: false, niosh: '' },
      rumore: { active: false, lex8h: '' },
      vibrazioni: { active: false, a8: '' },
      chimico: { active: false, sostanze: '' },
      polveri: { active: false, dettaglio: '' },
      biomeccanico: { active: false, note: '' },
      posture: { active: false, descrizione: '' }
    },
    accertamenti: {
      lab: [] as string[],
      strumentali: { spirometria: false, audiometria: false },
      tossicologici: false,
      allegato_rachide: false
    }
  },
  sezione6: { // Anamnesi
    lavorativa: '',
    altri_datori: '',
    familiare: '',
    fisiologica: {
      leva: 'Assolto',
      farmaci: '',
      alcol: 'No',
      fumatore: { status: 'No', sigarette: '', eta_inizio: '' },
      alvo_diuresi: ''
    },
    patologica_remota: [] as { id: number, data: string, nota: string }[],
    patologica_prossima: '',
    allergie: { nessuna: true, dettaglio: '' },
    vaccinazioni: [] as { id: number, tipo: string, scadenza: string }[]
  },
  sezione7: { // Eventi sanitari
    incidenti: '',
    invalidita: { status: false, percentuale: '', causa: '' },
    altre_notizie: ''
  },
  sezione8: { firma: '', data_firma: new Date().toISOString().split('T')[0] },
  sezione9: { // Esame Obiettivo
    vitali: { altezza: '', peso: '', condizioni: 'Buone' },
    distretti: {
      cardio: { toni: '', fc: '', pa: '' },
      digerente: '',
      urogenitale: { giordano_dx: 'Negativa', giordano_sx: 'Negativa' },
      respiratorio: '',
      osteoarticolare: { paravertebrali: '', rachide: '', lasegue_dx: 'Negativa', lasegue_sx: 'Negativa', movimenti: '', ginocchio_sx: '' }
    }
  },
  sezione10: { // Valutazione Accertamenti
    lab: [] as { id: number, esame: string, esito: 'Nei limiti' | 'Alterato', note: string }[],
    toss: [] as { id: number, marcatore: string, esito: string, note: string }[],
    spiro: { stato: 'Normale', note: '' }, // Normale / Alterata lieve / moderata / grave
    audio: { nota: '', rif_allegato: '' },
    questionari: ''
  },
  sezione11: {
    conclusioni: '',
    provvedimenti: '',
    giudizio: 'Idoneo',
    limitazioni: '',
    prescrizioni: '',
    data_nuova_visita: ''
  },
  sezione12: {
    data_lavoratore: new Date().toISOString().split('T')[0],
    data_datore: new Date().toISOString().split('T')[0],
    metodo: 'Email' // Email / PEC / Consegna a mano / Altro
  },
  sezione13: { firma_medico: '', conformita_elettronica: true, n_allegati: 0 },
  allegatoA: { // Rachide
    lordosi_c: 'Normale', lordosi_l: 'Normale', cifosi: 'Normale', scoliosi: false,
    test: { lasegue: 'Negativo', wasserman: 'Negativo', retrazioni: '', ritmo: '' },
    motilita: { cervicale: '', dorsolombare: '' },
    riflessi: { addominale: '', rotuleo: '', achilleo: '', plantare: '' },
    conclusioni: ''
  },
  allegatoB: { // Audiometria
    dpi: 'No', rischio_extra: '', otoscopico_dx: 'Normale', otoscopico_sx: 'Normale',
    audiogramma: {
      dx: { f250: '', f500: '', f1k: '', f2k: '', f3k: '', f4k: '', f6k: '', f8k: '' },
      sx: { f250: '', f500: '', f1k: '', f2k: '', f3k: '', f4k: '', f6k: '', f8k: '' }
    },
    diagnosi: ''
  }
};

interface SectionTitleProps {
  num: string;
  title: string;
  icon: React.ElementType;
}

const SectionTitle = ({ num, title, icon: Icon }: SectionTitleProps) => (
  <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-4">
    <div className="w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center text-primary font-black text-sm shadow-inner">{num}</div>
    <Icon size={20} className="text-tealAction" />
    <h3 className="font-black text-primary uppercase tracking-tight text-lg">{title}</h3>
  </div>
);

interface Worker {
  id: number;
  nome: string;
  cognome: string;
  codice_fiscale: string;
  data_nascita: string;
  mansione: string;
  data_assunzione: string;
  domicilio?: string;
  telefono?: string;
  company_id: number;
}

interface Company {
  id: number;
  ragione_sociale: string;
  sede_operativa?: string;
}

const NuovaVisita = () => {
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [step, setStep] = useState(1);
  const [visitData, setVisitData] = useState(INITIAL_VISIT_STATE);

  // --- HELPERS ---
  const validateCF = (cf: string) => /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cf?.toUpperCase() || '');

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const age = new Date().getFullYear() - birth.getFullYear();
    return age;
  };

  const imc = useMemo(() => {
    const h = parseFloat(visitData.sezione9.vitali.altezza) / 100;
    const w = parseFloat(visitData.sezione9.vitali.peso);
    return (h > 0 && w > 0) ? (w / (h * h)).toFixed(1) : '--';
  }, [visitData.sezione9.vitali.altezza, visitData.sezione9.vitali.peso]);

  useEffect(() => {
    if (selectedWorkerId) {
      const worker = executeQuery("SELECT * FROM workers WHERE id = ?", [selectedWorkerId])[0];
      setWorkerData(worker);
      const company = executeQuery("SELECT * FROM companies WHERE id = ?", [worker.company_id])[0];
      setCompanyData(company);

      // Auto-set from protocol
      const prot = executeQuery(`
        SELECT protocols.* FROM protocols
        JOIN workers ON workers.protocol_id = protocols.id
        WHERE workers.id = ?`, [selectedWorkerId])[0];

      if (prot) {
        const esami = JSON.parse(prot.esami || '[]');
        const needsRachide = esami.some((e: { nome: string }) => e.nome.toLowerCase().includes('rachide'));
        const hasAudio = esami.some((e: { nome: string }) => e.nome.toLowerCase().includes('audiometria'));
        const hasSpiro = esami.some((e: { nome: string }) => e.nome.toLowerCase().includes('spirometria'));

        setVisitData(prev => ({
          ...prev,
          sezione5: {
            ...prev.sezione5,
            accertamenti: {
              ...prev.sezione5.accertamenti,
              allegato_rachide: needsRachide,
              strumentali: { spirometria: hasSpiro, audiometria: hasAudio }
            }
          }
        }));
      }
    }
  }, [selectedWorkerId]);

  const handleSave = async () => {
    if (!selectedWorkerId) return;

    await runCommand(`
      INSERT INTO visits (
        worker_id, data_visita, tipo_visita, periodicita,
        sorveglianza_dati, anamnesi_fisiologica, eventi_sanitari,
        esame_obiettivo_strutturato, valutazione_accertamenti,
        giudizio, prescrizioni, scadenza_prossima,
        trasmissione_dati, allegato_a, allegato_b, finalized
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      selectedWorkerId, visitData.sezione1.data_visita, visitData.sezione1.tipo_visita, visitData.sezione1.periodicita,
      JSON.stringify(visitData.sezione5), JSON.stringify(visitData.sezione6), JSON.stringify(visitData.sezione7),
      JSON.stringify(visitData.sezione9), JSON.stringify(visitData.sezione10),
      visitData.sezione11.giudizio, visitData.sezione11.prescrizioni, visitData.sezione11.data_nuova_visita,
      JSON.stringify(visitData.sezione12), JSON.stringify(visitData.allegatoA), JSON.stringify(visitData.allegatoB)
    ]);

    generatePDF();
    alert("Cartella Sanitaria Art. 41 archiviata con successo.");
    setStep(1);
    setSelectedWorkerId('');
    setVisitData(INITIAL_VISIT_STATE);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const doctorData = executeQuery("SELECT * FROM doctor_profile WHERE id = 1")[0] || {};

    doc.setFont("helvetica", "bold");
    doc.text("CARTELLA SANITARIA E DI RISCHIO (ART. 41 D.LGS. 81/08)", 105, 15, { align: 'center' });
    doc.setFontSize(8);
    doc.text("(Allegato 3A - D.Lgs. 81/08 e s.m.i.)", 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text("SEZIONI 1-4: DATI GENERALI ED ANAGRAFICI", 15, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Data Visita: ${visitData.sezione1.data_visita} | Tipo: ${visitData.sezione1.tipo_visita}`, 20, 36);
    doc.text(`Azienda: ${companyData?.ragione_sociale || ''} - Unità: ${companyData?.sede_operativa || ''}`, 20, 41);
    doc.text(`Lavoratore: ${workerData?.cognome} ${workerData?.nome} | CF: ${workerData?.codice_fiscale}`, 20, 46);
    doc.text(`Mansione: ${workerData?.mansione} | Assunzione: ${workerData?.data_assunzione}`, 20, 51);

    doc.setFont("helvetica", "bold");
    doc.text("SEZIONE 11: GIUDIZIO DI IDONEITÀ", 15, 70);
    doc.setFontSize(14);
    doc.text(visitData.sezione11.giudizio.toUpperCase(), 20, 80);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (visitData.sezione11.prescrizioni) {
      doc.text(`Prescrizioni/Limitazioni: ${visitData.sezione11.prescrizioni}`, 20, 90, { maxWidth: 170 });
    }

    if (visitData.sezione13.firma_medico) {
      doc.addImage(visitData.sezione13.firma_medico, 'PNG', 130, 240, 50, 20);
    }
    doc.text(`Dott. ${doctorData.nome || ''}`, 130, 265);
    doc.text(`N. Iscr. ${doctorData.n_iscrizione || ''}`, 130, 270);

    doc.save(`CSR_ART41_${workerData?.cognome}_${visitData.sezione1.data_visita}.pdf`);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto pb-40 font-sans">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-black text-primary tracking-tighter uppercase italic">Cartella Sanitaria e di Rischio</h1>
        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">D.Lgs. 81/08 Art. 41 - Allegato 3A</p>
      </div>

      {/* STEP 1: INITIAL SELECTION & ANAGRAFICA */}
      {step === 1 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="glass-card p-10 rounded-[40px] shadow-2xl">
              <SectionTitle num="1-4" title="Dati Visita ed Anagrafica" icon={UserIcon} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ricerca Lavoratore</label>
                    <WorkerSearch onSelect={setSelectedWorkerId} />
                    <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-50">
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Data Visita</label>
                          <input type="date" className="input-standard !py-2 text-xs font-black" value={visitData.sezione1.data_visita} onChange={e => setVisitData({...visitData, sezione1: {...visitData.sezione1, data_visita: e.target.value}})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Periodicità</label>
                          <select className="input-standard !py-2 text-xs font-black" value={visitData.sezione1.periodicita} onChange={e => setVisitData({...visitData, sezione1: {...visitData.sezione1, periodicita: e.target.value}})}>
                             <option>Annuale</option><option>Biennale</option><option>Straordinaria</option><option>Su richiesta</option>
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Tipologia</label>
                          <select className="input-standard !py-2 text-xs font-black" value={visitData.sezione1.tipo_visita} onChange={e => setVisitData({...visitData, sezione1: {...visitData.sezione1, tipo_visita: e.target.value}})}>
                             <option>Periodica</option><option>Preventiva</option><option>Su richiesta</option><option>Cambio mansione</option><option>Ripresa lavoro</option><option>A richiesta lavoratore</option>
                          </select>
                       </div>
                    </div>
                 </div>

                 {workerData ? (
                   <div className="bg-tealAction/5 p-8 rounded-[40px] border border-tealAction/10 space-y-6 relative overflow-hidden">
                      <div className="relative z-10">
                         <div className="flex justify-between items-start mb-2">
                           <p className="text-[10px] font-black text-tealAction uppercase tracking-[0.2em]">{companyData?.ragione_sociale}</p>
                           <div className={`px-3 py-1 rounded-full text-[9px] font-black ${validateCF(workerData.codice_fiscale) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                             {validateCF(workerData.codice_fiscale) ? 'CF VALIDO' : 'CF INVALIDO'}
                           </div>
                         </div>
                         <p className="text-3xl font-black text-primary tracking-tighter leading-none">{workerData.cognome} {workerData.nome}</p>
                         <p className="text-xs font-bold text-gray-500 mt-2">{workerData.codice_fiscale} | {calculateAge(workerData.data_nascita)} ANNI</p>
                         <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-tealAction/10">
                            <div className="space-y-1">
                               <p className="text-[9px] font-black text-tealAction uppercase opacity-60">Mansione</p>
                               <p className="text-xs font-black text-primary truncate flex items-center gap-2"><Briefcase size={12}/> {workerData.mansione}</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[9px] font-black text-tealAction uppercase opacity-60">Domicilio</p>
                               <p className="text-xs font-black text-primary truncate flex items-center gap-2"><MapPin size={12}/> {workerData.domicilio || 'N.D.'}</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[9px] font-black text-tealAction uppercase opacity-60">Data Assunzione</p>
                               <p className="text-xs font-black text-primary truncate flex items-center gap-2"><Calendar size={12}/> {workerData.data_assunzione}</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[9px] font-black text-tealAction uppercase opacity-60">Telefono</p>
                               <p className="text-xs font-black text-primary truncate flex items-center gap-2"><Phone size={12}/> {workerData.telefono || 'N.D.'}</p>
                            </div>
                         </div>
                      </div>
                      <div className="absolute -right-12 -bottom-12 opacity-5 text-tealAction"><UserIcon size={240} /></div>
                   </div>
                 ) : (
                   <div className="bg-gray-50 border-2 border-dashed border-gray-100 rounded-[40px] flex flex-col items-center justify-center p-12 text-gray-200">
                      <UserIcon size={64} strokeWidth={1} />
                      <p className="text-[10px] font-black uppercase mt-4 tracking-widest text-center leading-relaxed">Identificare il lavoratore<br/>per avviare la cartella sanitaria</p>
                   </div>
                 )}
              </div>
              <div className="mt-12 pt-8 border-t border-gray-50 flex justify-end">
                 <button disabled={!selectedWorkerId} onClick={() => setStep(2)} className="btn-teal px-16 py-4 flex items-center gap-3 disabled:opacity-20 shadow-xl shadow-tealAction/20">Sezione Successiva <ChevronRight size={20}/></button>
              </div>
           </div>
        </div>
      )}

      {/* STEP 2: SECTION 5 - PROGRAMMA SORVEGLIANZA */}
      {step === 2 && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <div className="glass-card p-10 rounded-[40px] shadow-xl">
              <SectionTitle num="5" title="Programma Sorveglianza Sanitaria" icon={Shield} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-6 border-b border-gray-50 pb-2 flex items-center gap-2"><Activity size={14}/> Fattori di Rischio Obbligatori</p>
                    {[
                      { id: 'mmc', label: 'Movimentazione Carichi', sub: 'Indice NIOSH', k: 'niosh' },
                      { id: 'rumore', label: 'Esposizione Rumore', sub: 'LEX 8h dB(A)', k: 'lex8h' },
                      { id: 'vibrazioni', label: 'Vibrazioni M-B', sub: 'A(8) m/s2', k: 'a8' },
                      { id: 'chimico', label: 'Agenti Chimici', sub: 'Sostanze', k: 'sostanze' },
                      { id: 'polveri', label: 'Polveri', sub: 'Dettaglio', k: 'dettaglio' },
                    ].map(r => (
                      <div key={r.id} className={`flex items-center gap-4 p-4 rounded-3xl border transition-all ${ (visitData.sezione5.rischi as any)[r.id].active ? 'bg-tealAction/5 border-tealAction/20' : 'bg-warmWhite/30 border-transparent' }`}>
                         <input type="checkbox" className="w-6 h-6 rounded-lg text-tealAction" checked={(visitData.sezione5.rischi as any)[r.id].active}
                           onChange={e => {
                              const val = e.target.checked;
                              setVisitData(prev => ({...prev, sezione5: {...prev.sezione5, rischi: {...prev.sezione5.rischi, [r.id]: {...(prev.sezione5.rischi as any)[r.id], active: val}}}}));
                           }} />
                         <span className="text-[10px] font-black text-primary w-40 uppercase tracking-tighter">{r.label}</span>
                         <input disabled={!(visitData.sezione5.rischi as any)[r.id].active} placeholder={r.sub} className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs outline-none disabled:opacity-20 shadow-inner"
                           value={(visitData.sezione5.rischi as any)[r.id][r.k]}
                           onChange={e => {
                              const val = e.target.value;
                              setVisitData(prev => ({...prev, sezione5: {...prev.sezione5, rischi: {...prev.sezione5.rischi, [r.id]: {...(prev.sezione5.rischi as any)[r.id], [r.k]: val}}}}));
                           }} />
                      </div>
                    ))}
                 </div>
                 <div className="space-y-8">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4 border-b border-gray-50 pb-2 flex items-center gap-2"><Droplets size={14}/> Accertamenti Mirati</p>
                    <div className="bg-primary/5 p-8 rounded-[40px] space-y-6 shadow-inner">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Analisi Laboratorio Clinico</label>
                       <div className="flex flex-wrap gap-2">
                          {['GPT/ALT', 'VES', 'Emocromo', 'Creatininemia', 'GOT/AST', 'g-GT', 'Urine'].map(ex => (
                            <button key={ex} onClick={() => {
                               const list = visitData.sezione5.accertamenti.lab.includes(ex) ? visitData.sezione5.accertamenti.lab.filter(l => l !== ex) : [...visitData.sezione5.accertamenti.lab, ex];
                               setVisitData(prev => ({...prev, sezione5: {...prev.sezione5, accertamenti: {...prev.sezione5.accertamenti, lab: list}}}));
                            }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${visitData.sezione5.accertamenti.lab.includes(ex) ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-gray-300 border-gray-100'}`}>{ex}</button>
                          ))}
                       </div>
                       <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-primary/5">
                          <div className="bg-white p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                             <label className="text-[9px] font-black text-gray-400 uppercase">Esame Rachide</label>
                             <select className="bg-transparent font-black text-xs outline-none" value={visitData.sezione5.accertamenti.allegato_rachide ? 'si' : 'no'}
                               onChange={e => setVisitData(prev => ({...prev, sezione5: {...prev.sezione5, accertamenti: {...prev.sezione5.accertamenti, allegato_rachide: e.target.value === 'si'}}}))}>
                                <option value="no">NON PREVISTO</option><option value="si">ALLEGATO A</option>
                             </select>
                          </div>
                          <div className="bg-white p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                             <label className="text-[9px] font-black text-gray-400 uppercase">Audiometria</label>
                             <select className="bg-transparent font-black text-xs outline-none" value={visitData.sezione5.accertamenti.strumentali.audiometria ? 'si' : 'no'}
                               onChange={e => setVisitData(prev => ({...prev, sezione5: {...prev.sezione5, accertamenti: {...prev.sezione5.accertamenti, strumentali: { ...prev.sezione5.accertamenti.strumentali, audiometria: e.target.value === 'si' }}}}))}>
                                <option value="no">NON PREVISTA</option><option value="si">ALLEGATO B</option>
                             </select>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
           <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="btn-secondary px-8 py-3 flex items-center gap-2"><ChevronLeft size={18}/> Indietro</button>
              <button onClick={() => setStep(3)} className="btn-teal px-12 py-4 shadow-xl">Prossimo: Anamnesi <ChevronRight size={18}/></button>
           </div>
        </div>
      )}

      {/* STEP 3: ANAMNESI & EVENTI (SECTIONS 6-7) */}
      {step === 3 && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <div className="glass-card p-10 rounded-[40px] shadow-xl">
              <SectionTitle num="6" title="Anamnesi e Stato Fisiologico" icon={FileText} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anamnesi Familiare</label>
                       <textarea placeholder="Patologie ereditarie..." className="input-standard h-24 text-sm font-medium" value={visitData.sezione6.familiare} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, familiare: e.target.value}})} />
                    </div>
                    <div className="bg-primary/5 p-8 rounded-[40px] space-y-6 shadow-inner border border-primary/5">
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b border-primary/10 pb-2">Dati Fisiologici</p>
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                             <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Servizio Leva</label>
                             <select className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-black" value={visitData.sezione6.fisiologica.leva} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, fisiologica: {...visitData.sezione6.fisiologica, leva: e.target.value}}})}>
                                <option>Assolto</option><option>Non assolto</option><option>Non pertinente</option>
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Alvo e Diuresi</label>
                             <input className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-black" value={visitData.sezione6.fisiologica.alvo_diuresi} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, fisiologica: {...visitData.sezione6.fisiologica, alvo_diuresi: e.target.value}}})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Alcol</label>
                             <select className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-black" value={visitData.sezione6.fisiologica.alcol} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, fisiologica: {...visitData.sezione6.fisiologica, alcol: e.target.value}}})}>
                                <option>No</option><option>Sì</option>
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Fumatore</label>
                             <select className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-black" value={visitData.sezione6.fisiologica.fumatore.status} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, fisiologica: {...visitData.sezione6.fisiologica, fumatore: {...visitData.sezione6.fisiologica.fumatore, status: e.target.value}}}})}>
                                <option>No</option><option>Sì</option>
                             </select>
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="space-y-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anamnesi Lavorativa</label>
                       <textarea placeholder="Esposizioni e mansioni passate..." className="input-standard h-40 text-sm font-medium" value={visitData.sezione6.lavorativa} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, lavorativa: e.target.value}})} />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contemporanea esposizione altri datori</label>
                       <textarea className="input-standard h-20 text-sm font-medium" value={visitData.sezione6.altri_datori} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, altri_datori: e.target.value}})} />
                    </div>
                 </div>
              </div>
           </div>

           <div className="glass-card p-10 rounded-[40px] shadow-xl">
              <SectionTitle num="7" title="Eventi Sanitari e Infortuni" icon={AlertCircle} />
              <div className="space-y-6">
                 <textarea placeholder="Incidenti, malattie professionali, traumi..." className="input-standard h-24" value={visitData.sezione7.incidenti} onChange={e => setVisitData({...visitData, sezione7: {...visitData.sezione7, incidenti: e.target.value}})} />
                 <div className="bg-accent/5 p-6 rounded-3xl border border-accent/10 flex items-center gap-8">
                    <label className="flex items-center gap-3 cursor-pointer">
                       <input type="checkbox" className="w-6 h-6 rounded-lg text-accent" checked={visitData.sezione7.invalidita.status}
                        onChange={e => {
                          const val = e.target.checked;
                          setVisitData(prev => ({...prev, sezione7: {...prev.sezione7, invalidita: {...prev.sezione7.invalidita, status: val}}}));
                        }} />
                       <span className="text-xs font-black text-primary uppercase tracking-widest">Invalidità Riconosciuta</span>
                    </label>
                    {visitData.sezione7.invalidita.status && (
                       <div className="flex-1 flex gap-4 animate-in slide-in-from-left-4">
                          <input placeholder="%" className="w-32 input-standard !py-2 text-xs" value={visitData.sezione7.invalidita.percentuale}
                            onChange={e => {
                              const val = e.target.value;
                              setVisitData(prev => ({...prev, sezione7: {...prev.sezione7, invalidita: {...prev.sezione7.invalidita, percentuale: val}}}));
                            }} />
                          <input placeholder="Causa" className="flex-1 input-standard !py-2 text-xs" value={visitData.sezione7.invalidita.causa}
                            onChange={e => {
                              const val = e.target.value;
                              setVisitData(prev => ({...prev, sezione7: {...prev.sezione7, invalidita: {...prev.sezione7.invalidita, causa: val}}}));
                            }} />
                       </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="btn-secondary px-8 py-3 flex items-center gap-2"><ChevronLeft size={18}/> Indietro</button>
              <button onClick={() => setStep(4)} className="btn-teal px-12 py-4 shadow-xl">Prossimo: Esame Obiettivo <ChevronRight size={18}/></button>
           </div>
        </div>
      )}

      {/* STEP 4: ESAME OBIETTIVO (SECTION 9-10 + ANNEX A/B) */}
      {step === 4 && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <div className="glass-card p-10 rounded-[40px] shadow-xl">
              <SectionTitle num="9" title="Esame Obiettivo Strutturato" icon={Stethoscope} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                 <div className="bg-warmWhite/30 p-4 rounded-2xl flex flex-col gap-1 border border-gray-100 shadow-inner">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Altezza (cm)</label>
                    <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitData.sezione9.vitali.altezza} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, vitali: {...visitData.sezione9.vitali, altezza: e.target.value}}})} />
                 </div>
                 <div className="bg-warmWhite/30 p-4 rounded-2xl flex flex-col gap-1 border border-gray-100 shadow-inner">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Peso (kg)</label>
                    <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitData.sezione9.vitali.peso} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, vitali: {...visitData.sezione9.vitali, peso: e.target.value}}})} />
                 </div>
                 <div className="bg-primary/5 p-4 rounded-2xl flex flex-col justify-center items-center border border-primary/10">
                    <label className="text-[9px] font-black text-primary uppercase tracking-widest">IMC (BMI)</label>
                    <p className="font-black text-2xl text-primary tracking-tighter">{imc}</p>
                 </div>
                 <div className="bg-warmWhite/30 p-4 rounded-2xl flex flex-col gap-1 border border-gray-100 shadow-inner">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Stato Generale</label>
                    <select className="bg-transparent font-black text-xs outline-none mt-2" value={visitData.sezione9.vitali.condizioni} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, vitali: {...visitData.sezione9.vitali, condizioni: e.target.value}}})}>
                       <option>Buone</option><option>Discrete</option><option>Scadenti</option>
                    </select>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="bg-white border border-gray-100 p-8 rounded-3xl space-y-6 shadow-sm">
                       <p className="text-[10px] font-black text-tealAction uppercase flex items-center gap-2 border-b border-gray-50 pb-2"><Heart size={14} /> Apparato Cardiovascolare</p>
                       <div className="grid grid-cols-3 gap-4">
                          <input placeholder="Toni" className="input-standard !py-2 text-xs" value={visitData.sezione9.distretti.cardio.toni} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, cardio: {...visitData.sezione9.distretti.cardio, toni: e.target.value}}}})} />
                          <input placeholder="F.C." className="input-standard !py-2 text-xs" value={visitData.sezione9.distretti.cardio.fc} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, cardio: {...visitData.sezione9.distretti.cardio, fc: e.target.value}}}})} />
                          <input placeholder="PA (es. 120/80)" className="input-standard !py-2 text-xs" value={visitData.sezione9.distretti.cardio.pa} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, cardio: {...visitData.sezione9.distretti.cardio, pa: e.target.value}}}})} />
                       </div>
                    </div>
                    <div className="bg-white border border-gray-100 p-8 rounded-3xl space-y-4 shadow-sm">
                       <p className="text-[10px] font-black text-tealAction uppercase flex items-center gap-2 border-b border-gray-50 pb-2"><Wind size={14} /> Apparato Respiratorio</p>
                       <textarea placeholder="Murmure vescicolare..." className="input-standard h-20 text-xs" value={visitData.sezione9.distretti.respiratorio} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, respiratorio: e.target.value}}})} />
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="bg-white border border-gray-100 p-8 rounded-3xl space-y-6 shadow-sm">
                       <p className="text-[10px] font-black text-tealAction uppercase flex items-center gap-2 border-b border-gray-50 pb-2"><Activity size={14} /> Apparato Osteoarticolare</p>
                       <div className="flex gap-4">
                          <select className="flex-1 input-standard !py-2 text-xs" value={visitData.sezione9.distretti.osteoarticolare.lasegue_dx} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, osteoarticolare: {...visitData.sezione9.distretti.osteoarticolare, lasegue_dx: e.target.value}}}})}>
                             <option>Lasegue DX: Negativa</option><option>Lasegue DX: Positiva</option>
                          </select>
                          <select className="flex-1 input-standard !py-2 text-xs" value={visitData.sezione9.distretti.osteoarticolare.lasegue_sx} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, osteoarticolare: {...visitData.sezione9.distretti.osteoarticolare, lasegue_sx: e.target.value}}}})}>
                             <option>Lasegue SX: Negativa</option><option>Lasegue SX: Positiva</option>
                          </select>
                       </div>
                       <textarea placeholder="Rachide, paravertebrali, movimenti..." className="input-standard h-20 text-xs font-medium" value={visitData.sezione9.distretti.osteoarticolare.movimenti} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, osteoarticolare: {...visitData.sezione9.distretti.osteoarticolare, movimenti: e.target.value}}}})} />
                    </div>
                 </div>
              </div>
           </div>

           {/* ALLEGATI SPECIALISTICI (ONLY IF SELECTED IN STEP 2) */}
           {(visitData.sezione5.accertamenti.allegato_rachide || visitData.sezione5.accertamenti.strumentali.audiometria) && (
             <div className="space-y-12 border-t-4 border-accent/20 pt-12">
                <div className="flex items-center gap-3">
                   <div className="p-3 bg-accent text-white rounded-2xl shadow-lg shadow-accent/20"><AlertCircle size={24} /></div>
                   <h2 className="text-2xl font-black text-primary uppercase tracking-tight italic">Moduli Specialistici Allegati</h2>
                </div>

                {visitData.sezione5.accertamenti.allegato_rachide && (
                   <div className="bg-white border-2 border-accent/10 p-10 rounded-[40px] shadow-2xl animate-in slide-in-from-bottom-6 duration-500">
                      <SectionTitle num="A" title="Valutazione Funzionale Rachide" icon={Activity} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                         <div className="space-y-6">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-gray-50 pb-2">Analisi Curvature</p>
                            <div className="grid grid-cols-2 gap-4">
                               {['lordosi_c', 'lordosi_l', 'cifosi'].map(curv => (
                                 <div key={curv} className="bg-warmWhite/50 p-4 rounded-2xl shadow-inner">
                                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">{curv.replace('_', ' ')}</label>
                                    <select className="w-full text-xs font-black bg-transparent outline-none mt-1" value={(visitData.allegatoA as any)[curv]} onChange={e => setVisitData({...visitData, allegatoA: {...visitData.allegatoA, [curv]: e.target.value}})}>
                                       <option>Normale</option><option>Accentuata</option><option>Appiattita</option>
                                    </select>
                                 </div>
                               ))}
                            </div>
                         </div>
                         <div className="space-y-4">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-gray-50 pb-2">Conclusioni Allegato A</p>
                            <textarea placeholder="Esito valutazione rachide..." className="input-standard h-40 text-sm font-medium" value={visitData.allegatoA.conclusioni} onChange={e => setVisitData({...visitData, allegatoA: {...visitData.allegatoA, conclusioni: e.target.value}})} />
                         </div>
                      </div>
                   </div>
                )}

                {visitData.sezione5.accertamenti.strumentali.audiometria && (
                   <div className="bg-white border-2 border-tealAction/10 p-10 rounded-[40px] shadow-2xl animate-in slide-in-from-bottom-6 duration-700">
                      <SectionTitle num="B" title="Scheda Audiometrica" icon={Activity} />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                         <div className="bg-warmWhite/50 p-5 rounded-2xl shadow-inner">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">DPI Otoprotettori</label>
                            <select className="w-full bg-transparent font-black text-xs outline-none mt-2" value={visitData.allegatoB.dpi} onChange={e => setVisitData({...visitData, allegatoB: {...visitData.allegatoB, dpi: e.target.value}})}>
                               <option>No</option><option>Sì</option>
                            </select>
                         </div>
                         <div className="bg-warmWhite/50 p-5 rounded-2xl shadow-inner">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Esame Otoscopico DX</label>
                            <input className="w-full bg-transparent font-black text-xs outline-none mt-2 border-b border-gray-100" value={visitData.allegatoB.otoscopico_dx} onChange={e => setVisitData({...visitData, allegatoB: {...visitData.allegatoB, otoscopico_dx: e.target.value}})} />
                         </div>
                         <div className="bg-warmWhite/50 p-5 rounded-2xl shadow-inner">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Esame Otoscopico SX</label>
                            <input className="w-full bg-transparent font-black text-xs outline-none mt-2 border-b border-gray-100" value={visitData.allegatoB.otoscopico_sx} onChange={e => setVisitData({...visitData, allegatoB: {...visitData.allegatoB, otoscopico_sx: e.target.value}})} />
                         </div>
                      </div>
                      <div className="bg-primary/5 p-8 rounded-3xl">
                         <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-6 text-center italic opacity-60">Griglia Audiogramma (DX / SX)</p>
                         <div className="grid grid-cols-9 gap-4 text-center items-center">
                            <div className="text-[9px] font-black text-gray-300">Hz</div>
                            {['250', '500', '1k', '2k', '3k', '4k', '6k', '8k'].map(f => <div key={f} className="text-[10px] font-black text-primary">{f}</div>)}
                            <div className="text-[11px] font-black text-tealAction">DX</div>
                            {['f250', 'f500', 'f1k', 'f2k', 'f3k', 'f4k', 'f6k', 'f8k'].map(f => (
                              <input key={f} className="w-full text-center text-xs font-black py-2 rounded-xl border border-gray-100 shadow-sm" value={(visitData.allegatoB.audiogramma.dx as any)[f]}
                                onChange={e => {
                                  const val = e.target.value;
                                  setVisitData(prev => ({...prev, allegatoB: {...prev.allegatoB, audiogramma: {...prev.allegatoB.audiogramma, dx: {...prev.allegatoB.audiogramma.dx, [f]: val}}}}));
                                }} />
                            ))}
                         </div>
                      </div>
                   </div>
                )}
             </div>
           )}

           <div className="flex justify-between mt-12 pt-12 border-t border-gray-50">
              <button onClick={() => setStep(3)} className="btn-secondary px-8 py-3 flex items-center gap-2"><ChevronLeft size={18}/> Indietro</button>
              <button onClick={() => setStep(5)} className="btn-teal px-12 py-4 shadow-xl shadow-tealAction/20">Giudizio e Firme <ChevronRight size={18}/></button>
           </div>
        </div>
      )}

      {/* STEP 5: GIUDIZIO & FIRME */}
      {step === 5 && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <div className="glass-card p-10 rounded-[40px] border-tealAction/20 shadow-2xl">
              <SectionTitle num="11" title="Giudizio di Idoneità" icon={CheckCircle} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-4">
                    {['Idoneo', 'Idoneo con limitazioni', 'Idoneo con prescrizioni', 'Inidoneo temporaneo', 'Inidoneo permanente'].map(g => (
                      <label key={g} className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all cursor-pointer ${visitData.sezione11.giudizio === g ? 'bg-primary/5 border-primary shadow-xl scale-[1.02]' : 'bg-white border-gray-100'}`}>
                         <input type="radio" name="giudizio" className="w-6 h-6 text-primary" checked={visitData.sezione11.giudizio === g} onChange={() => setVisitData({...visitData, sezione11: {...visitData.sezione11, giudizio: g}})} />
                         <span className="text-sm font-black uppercase text-primary">{g}</span>
                      </label>
                    ))}
                 </div>
                 <div className="space-y-8">
                    <textarea placeholder="Indicare prescrizioni e limitazioni..." className="input-standard h-48 text-sm font-bold shadow-xl border-accent/20" value={visitData.sezione11.prescrizioni} onChange={e => setVisitData({...visitData, sezione11: {...visitData.sezione11, prescrizioni: e.target.value}})} />
                    {visitData.sezione11.giudizio.includes('temporaneo') && (
                       <div className="bg-red-50 p-8 rounded-3xl border-2 border-red-100 animate-in zoom-in duration-300">
                          <p className="text-[10px] font-black text-red-600 uppercase flex items-center gap-2"><Clock size={16} /> Richiamo Obbligatorio</p>
                          <label className="text-[9px] font-bold text-gray-500 uppercase">Data prevista nuova visita</label>
                          <input type="date" className="input-standard mt-4" value={visitData.sezione11.data_nuova_visita} onChange={e => setVisitData({...visitData, sezione11: {...visitData.sezione11, data_nuova_visita: e.target.value}})} />
                       </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="glass-card p-10 rounded-[40px] shadow-xl">
              <SectionTitle num="13" title="Validazione e Firme" icon={PenTool} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                 <div className="space-y-6">
                    <SignatureInput label="Firma del Lavoratore (per presa visione)" onSave={sig => setVisitData({...visitData, sezione8: {...visitData.sezione8, firma: sig}})} />
                    <p className="text-[9px] text-gray-400 font-medium leading-relaxed bg-gray-50 p-4 rounded-2xl italic border border-gray-100">
                       Dichiaro di aver ricevuto copia del giudizio di idoneità e di essere stato informato sugli accertamenti effettuati.
                    </p>
                 </div>
                 <div className="space-y-6">
                    <SignatureInput label="Firma del Medico Competente" onSave={sig => setVisitData({...visitData, sezione13: {...visitData.sezione13, firma_medico: sig}})} />
                    <label className="flex items-center gap-3 cursor-pointer group mt-4">
                       <input type="checkbox" className="w-5 h-5 rounded border-gray-200 text-primary" checked={visitData.sezione13.conformita_elettronica} onChange={e => setVisitData({...visitData, sezione13: {...visitData.sezione13, conformita_elettronica: e.target.checked}})} />
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-primary transition-colors">Dichiaro conformità copia elettronica</span>
                    </label>
                 </div>
              </div>
           </div>

           <div className="flex justify-between items-center bg-sidebar p-10 rounded-[50px] shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-accent/5 opacity-20 pointer-events-none" />
              <button onClick={() => setStep(4)} className="text-white/40 font-black uppercase text-xs hover:text-white transition relative z-10 flex items-center gap-2"><ChevronLeft size={16}/> Indietro</button>
              <div className="flex gap-6 relative z-10">
                 <button onClick={handleSave} className="btn-accent px-20 py-6 text-lg font-black flex items-center gap-4 shadow-[0_20px_50px_rgba(232,130,12,0.4)] hover:scale-[1.02] transition-all">
                   <Download size={28} strokeWidth={3} /> FINALIZZA E ARCHIVIA
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default NuovaVisita;
