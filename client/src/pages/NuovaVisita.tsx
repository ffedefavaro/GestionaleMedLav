import { useState, useEffect, useMemo } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import {
  Activity, CheckCircle, Download,
  Heart, Wind, Stethoscope, Shield, User as UserIcon,
  PenTool, FileText, ChevronRight, ChevronLeft, AlertCircle, Clock, Building2, MapPin, Phone
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import WorkerSearch from '../components/WorkerSearch';
import { SignatureInput } from '../components/visita/SignatureInput';

// --- INITIAL STATE ---
const INITIAL_VISIT_STATE = {
  sezione1: {
    data_visita: new Date().toISOString().split('T')[0],
    periodicita: 'Annuale',
    tipo_visita: 'Periodica'
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
      allegato_rachide: false,
      allegato_epm: false
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
    patologica_prossima: '',
    allergie: { nessuna: true, dettaglio: '' }
  },
  sezione7: { // Eventi sanitari
    incidenti: '',
    invalidita: { status: false, percentuale: '', causa: '' }
  },
  sezione8: { firma: '' },
  sezione9: { // Esame Obiettivo
    vitali: { altezza: '', peso: '', condizioni: 'Buone' },
    distretti: {
      cardio: { toni: '', fc: '', pa: '' },
      digerente: '',
      respiratorio: '',
      osteoarticolare: { paravertebrali: '', rachide: '', lasegue_dx: 'Negativa', lasegue_sx: 'Negativa', movimenti: '' },
      urogenitale: { giordano_dx: 'Negativa', giordano_sx: 'Negativa' }
    }
  },
  sezione11: {
    conclusioni: '',
    giudizio: 'Idoneo',
    prescrizioni: '',
    data_nuova_visita: ''
  },
  sezione12: { data_lavoratore: '', data_datore: '', metodo: 'Email' },
  sezione13: { firma_medico: '', conformita_elettronica: true },
  allegatoA: { // Rachide
    lordosi_c: 'Normale', lordosi_l: 'Normale', cifosi: 'Normale', scoliosi: false,
    conclusioni: ''
  },
  allegatoB: { // Audiometria
    dpi: 'No', otoscopico_dx: 'Normale', otoscopico_sx: 'Normale',
    audiogramma: {
      dx: { f250: '', f500: '', f1k: '', f2k: '', f3k: '', f4k: '', f6k: '', f8k: '' },
      sx: { f250: '', f500: '', f1k: '', f2k: '', f3k: '', f4k: '', f6k: '', f8k: '' }
    }
  }
};

const NuovaVisita = () => {
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerData, setWorkerData] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [visitData, setVisitData] = useState(INITIAL_VISIT_STATE);

  // --- HELPERS ---

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
      JSON.stringify(visitData.sezione9), JSON.stringify({}),
      visitData.sezione11.giudizio, visitData.sezione11.prescrizioni, visitData.sezione11.data_nuova_visita,
      JSON.stringify(visitData.sezione12), JSON.stringify(visitData.allegatoA), JSON.stringify(visitData.allegatoB)
    ]);
    generatePDF();
    alert("Visita archiviata.");
    setStep(1); setSelectedWorkerId(''); setVisitData(INITIAL_VISIT_STATE);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const doctorData = executeQuery("SELECT * FROM doctor_profile WHERE id = 1")[0] || {};

    // Function to add a structured header
    const addHeader = (title: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(title, 105, 15, { align: 'center' });
      doc.setFontSize(8);
      doc.text("(D.Lgs. 81/08 e s.m.i. - Allegato 3A)", 105, 20, { align: 'center' });
      doc.line(15, 22, 195, 22);
    };

    // PAGE 1: SECTIONS 1-4
    addHeader("CARTELLA SANITARIA E DI RISCHIO");
    doc.setFontSize(10);
    doc.text("SEZIONE 1 - DATI VISITA", 15, 30);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Data: ${visitData.sezione1.data_visita} | Tipo: ${visitData.sezione1.tipo_visita} | Periodo: ${visitData.sezione1.periodicita}`, 20, 36);

    doc.setFont("helvetica", "bold"); doc.text("SEZIONE 2 - DATI AZIENDALI", 15, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`Azienda: ${companyData?.ragione_sociale}`, 20, 51);
    doc.text(`Sede: ${companyData?.sede_operativa || 'N.D.'}`, 20, 56);

    doc.setFont("helvetica", "bold"); doc.text("SEZIONE 3 - ANAGRAFICA LAVORATORE", 15, 65);
    doc.setFont("helvetica", "normal");
    doc.text(`Lavoratore: ${workerData?.cognome} ${workerData?.nome} | Sesso: ${workerData?.sesso}`, 20, 71);
    doc.text(`C.F.: ${workerData?.codice_fiscale} | Nato a: ${workerData?.luogo_nascita} il ${workerData?.data_nascita}`, 20, 76);

    doc.setFont("helvetica", "bold"); doc.text("SEZIONE 4 - DATI OCCUPAZIONALI", 15, 85);
    doc.setFont("helvetica", "normal");
    doc.text(`Mansione: ${workerData?.mansione}`, 20, 91);
    doc.text(`Data Assunzione: ${workerData?.data_assunzione}`, 20, 96);

    // PAGE 2 (Simplification for brevity in this step)
    doc.addPage();
    addHeader("VALUTAZIONI E GIUDIZIO");
    doc.setFont("helvetica", "bold"); doc.text("SEZIONE 11 - GIUDIZIO DI IDONEITÀ", 15, 35);
    doc.setFontSize(16); doc.text(visitData.sezione11.giudizio.toUpperCase(), 20, 45);
    doc.setFontSize(10);
    if (visitData.sezione11.prescrizioni) {
      doc.text("Prescrizioni/Limitazioni:", 20, 55);
      doc.setFont("helvetica", "normal");
      doc.text(visitData.sezione11.prescrizioni, 25, 62, { maxWidth: 160 });
    }

    // Signatures
    if (visitData.sezione8.firma) {
      doc.addImage(visitData.sezione8.firma, 'PNG', 20, 230, 50, 20);
      doc.setFontSize(8); doc.text("Firma Lavoratore", 25, 255);
    }
    if (visitData.sezione13.firma_medico) {
      doc.addImage(visitData.sezione13.firma_medico, 'PNG', 130, 230, 50, 20);
      doc.setFontSize(8); doc.text(`Dott. ${doctorData.nome || ''}`, 135, 255);
    }

    doc.save(`Cartella_Art41_${workerData?.cognome}_${visitData.sezione1.data_visita}.pdf`);
  };

  const SectionTitle = ({ num, title, icon: Icon }: { num: string, title: string, icon: any }) => (
    <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-4">
      <div className="w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center text-primary font-black text-sm shadow-inner">{num}</div>
      <Icon size={20} className="text-tealAction" />
      <h3 className="font-black text-primary uppercase tracking-tight text-lg">{title}</h3>
    </div>
  );

  return (
    <div className="p-10 max-w-7xl mx-auto pb-40">
      {step === 1 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="glass-card p-10 rounded-[40px] shadow-2xl">
              <SectionTitle num="1-4" title="Inquadramento" icon={UserIcon} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <WorkerSearch onSelect={setSelectedWorkerId} />
                    <div className="grid grid-cols-3 gap-4 pt-6">
                       <input type="date" className="input-standard" value={visitData.sezione1.data_visita} onChange={e => setVisitData({...visitData, sezione1: {...visitData.sezione1, data_visita: e.target.value}})} />
                       <select className="input-standard" value={visitData.sezione1.periodicita} onChange={e => setVisitData({...visitData, sezione1: {...visitData.sezione1, periodicita: e.target.value}})}>
                          <option>Annuale</option><option>Biennale</option>
                       </select>
                       <select className="input-standard" value={visitData.sezione1.tipo_visita} onChange={e => setVisitData({...visitData, sezione1: {...visitData.sezione1, tipo_visita: e.target.value}})}>
                          <option>Periodica</option><option>Preventiva</option>
                       </select>
                    </div>
                 </div>
                 {workerData && (
                   <div className="bg-tealAction/5 p-8 rounded-[40px] border border-tealAction/10">
                      <p className="text-3xl font-black text-primary">{workerData.cognome} {workerData.nome}</p>
                      <div className="grid grid-cols-2 gap-4 mt-6">
                         <div className="flex items-center gap-2 text-gray-400 text-[10px] font-bold uppercase"><Building2 size={14}/> {companyData?.ragione_sociale}</div>
                         <div className="flex items-center gap-2 text-gray-400 text-[10px] font-bold uppercase"><MapPin size={14}/> {workerData.domicilio || 'N/D'}</div>
                         <div className="flex items-center gap-2 text-gray-400 text-[10px] font-bold uppercase"><Stethoscope size={14}/> {workerData.mansione}</div>
                         <div className="flex items-center gap-2 text-gray-400 text-[10px] font-bold uppercase"><Phone size={14}/> {workerData.telefono || 'N/D'}</div>
                      </div>
                   </div>
                 )}
              </div>
              <div className="mt-12 flex justify-end">
                 <button disabled={!selectedWorkerId} onClick={() => setStep(2)} className="btn-teal px-16 py-4 flex items-center gap-3 disabled:opacity-20 shadow-xl">Successivo <ChevronRight size={20}/></button>
              </div>
           </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <div className="glass-card p-10 rounded-[40px] shadow-xl">
              <SectionTitle num="5" title="Programma Sorveglianza" icon={Shield} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-4">
                    {[{id:'mmc', label:'MMC'}, {id:'rumore', label:'Rumore'}].map(r => (
                      <div key={r.id} className="flex items-center gap-4 p-4 rounded-3xl border bg-warmWhite/30">
                         <input type="checkbox" className="w-6 h-6 rounded-lg text-tealAction" checked={(visitData.sezione5.rischi as any)[r.id].active} onChange={e => {
                            const val = e.target.checked;
                            setVisitData(prev => ({...prev, sezione5: {...prev.sezione5, rischi: {...prev.sezione5.rischi, [r.id]: {...(prev.sezione5.rischi as any)[r.id], active: val}}}}));
                         }} />
                         <span className="text-[10px] font-black text-primary uppercase w-32">{r.label}</span>
                         <input disabled={!(visitData.sezione5.rischi as any)[r.id].active} placeholder="Valore..." className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs outline-none" value={(visitData.sezione5.rischi as any)[r.id].niosh || (visitData.sezione5.rischi as any)[r.id].lex8h} onChange={e => {
                            const val = e.target.value;
                            setVisitData(prev => ({...prev, sezione5: {...prev.sezione5, rischi: {...prev.sezione5.rischi, [r.id]: {...(prev.sezione5.rischi as any)[r.id], niosh: val, lex8h: val}}}}));
                         }} />
                      </div>
                    ))}
                 </div>
                 <div className="space-y-6">
                    <div className="bg-primary/5 p-8 rounded-[40px] shadow-inner">
                       <label className="text-[10px] font-black uppercase tracking-widest block border-b border-primary/10 pb-2">Accertamenti</label>
                       <div className="grid grid-cols-2 gap-4 mt-6">
                          <select className="input-standard" value={visitData.sezione5.accertamenti.allegato_rachide ? 'si' : 'no'} onChange={e => setVisitData({...visitData, sezione5: {...visitData.sezione5, accertamenti: {...visitData.sezione5.accertamenti, allegato_rachide: e.target.value === 'si'}}})}>
                             <option value="no">RACHIDE: NO</option><option value="si">RACHIDE: SÌ</option>
                          </select>
                          <select className="input-standard" value={visitData.sezione5.accertamenti.strumentali.audiometria ? 'si' : 'no'} onChange={e => setVisitData({...visitData, sezione5: {...visitData.sezione5, accertamenti: {...visitData.sezione5.accertamenti, strumentali: {...visitData.sezione5.accertamenti.strumentali, audiometria: e.target.value === 'si'}}}})}>
                             <option value="no">AUDIO: NO</option><option value="si">AUDIO: SÌ</option>
                          </select>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
           <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="btn-secondary px-8 py-3 flex items-center gap-2"><ChevronLeft size={18}/> Indietro</button>
              <button onClick={() => setStep(3)} className="btn-teal px-12 py-4 shadow-xl">Successivo <ChevronRight size={18}/></button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <div className="glass-card p-10 rounded-[40px] shadow-xl">
              <SectionTitle num="6-7" title="Anamnesi ed Eventi" icon={FileText} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-6">
                    <textarea placeholder="Anamnesi familiare..." className="input-standard h-24" value={visitData.sezione6.familiare} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, familiare: e.target.value}})} />
                    <div className="bg-primary/5 p-6 rounded-3xl space-y-4">
                       <p className="text-[10px] font-black text-primary uppercase border-b border-primary/10 pb-2">Fisiologica</p>
                       <div className="grid grid-cols-2 gap-4">
                          <input placeholder="Alvo/Diuresi" className="input-standard" value={visitData.sezione6.fisiologica.alvo_diuresi} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, fisiologica: {...visitData.sezione6.fisiologica, alvo_diuresi: e.target.value}}})} />
                          <select className="input-standard" value={visitData.sezione6.fisiologica.alcol} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, fisiologica: {...visitData.sezione6.fisiologica, alcol: e.target.value}}})}>
                             <option>Alcol: No</option><option>Alcol: Sì</option>
                          </select>
                       </div>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <textarea placeholder="Anamnesi lavorativa passata..." className="input-standard h-40" value={visitData.sezione6.lavorativa} onChange={e => setVisitData({...visitData, sezione6: {...visitData.sezione6, lavorativa: e.target.value}})} />
                    <div className="bg-accent/5 p-6 rounded-3xl border border-accent/10 flex items-center gap-8">
                       <label className="flex items-center gap-3">
                          <input type="checkbox" className="w-6 h-6" checked={visitData.sezione7.invalidita.status} onChange={e => setVisitData({...visitData, sezione7: {...visitData.sezione7, invalidita: {...visitData.sezione7.invalidita, status: e.target.checked}}})} />
                          <span className="text-xs font-black uppercase">Invalidità</span>
                       </label>
                       {visitData.sezione7.invalidita.status && (
                          <input placeholder="%" className="w-32 input-standard" value={visitData.sezione7.invalidita.percentuale} onChange={e => setVisitData({...visitData, sezione7: {...visitData.sezione7, invalidita: {...visitData.sezione7.invalidita, percentuale: e.target.value}}})} />
                       )}
                    </div>
                 </div>
              </div>
           </div>
           <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="btn-secondary px-8 py-3"><ChevronLeft size={18}/> Indietro</button>
              <button onClick={() => setStep(4)} className="btn-teal px-12 py-4 shadow-xl">Successivo <ChevronRight size={18}/></button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <div className="glass-card p-10 rounded-[40px] shadow-xl">
              <SectionTitle num="9" title="Esame Obiettivo" icon={Stethoscope} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                 <div className="bg-warmWhite/30 p-4 rounded-2xl border border-gray-100 shadow-inner">
                    <label className="text-[9px] font-black text-gray-400 uppercase">Altezza (cm)</label>
                    <input type="number" className="bg-transparent font-black text-xl text-primary outline-none w-full" value={visitData.sezione9.vitali.altezza} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, vitali: {...visitData.sezione9.vitali, altezza: e.target.value}}})} />
                 </div>
                 <div className="bg-warmWhite/30 p-4 rounded-2xl border border-gray-100 shadow-inner">
                    <label className="text-[9px] font-black text-gray-400 uppercase">Peso (kg)</label>
                    <input type="number" className="bg-transparent font-black text-xl text-primary outline-none w-full" value={visitData.sezione9.vitali.peso} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, vitali: {...visitData.sezione9.vitali, peso: e.target.value}}})} />
                 </div>
                 <div className="bg-primary/5 p-4 rounded-2xl flex flex-col justify-center items-center">
                    <label className="text-[9px] font-black text-primary uppercase">IMC (BMI)</label>
                    <p className="font-black text-2xl text-primary">{imc}</p>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="bg-white border border-gray-100 p-8 rounded-3xl space-y-6">
                    <p className="text-[10px] font-black text-tealAction uppercase flex items-center gap-2"><Heart size={14} /> Cardio</p>
                    <input placeholder="Toni / PA / FC" className="input-standard" value={visitData.sezione9.distretti.cardio.pa} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, cardio: {...visitData.sezione9.distretti.cardio, pa: e.target.value}}}})} />
                    <p className="text-[10px] font-black text-tealAction uppercase flex items-center gap-2 border-t border-gray-50 pt-4 mt-4"><Wind size={14} /> Respiratorio</p>
                    <textarea placeholder="MV..." className="input-standard h-20" value={visitData.sezione9.distretti.respiratorio} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, respiratorio: e.target.value}}})} />
                 </div>
                 <div className="bg-white border border-gray-100 p-8 rounded-3xl space-y-6">
                    <p className="text-[10px] font-black text-tealAction uppercase flex items-center gap-2"><Activity size={14} /> Osteoarticolare</p>
                    <div className="flex gap-4">
                       <select className="input-standard" value={visitData.sezione9.distretti.osteoarticolare.lasegue_dx} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, osteoarticolare: {...visitData.sezione9.distretti.osteoarticolare, lasegue_dx: e.target.value}}}})}><option>DX: Negativa</option><option>DX: Positiva</option></select>
                       <select className="input-standard" value={visitData.sezione9.distretti.osteoarticolare.lasegue_sx} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, osteoarticolare: {...visitData.sezione9.distretti.osteoarticolare, lasegue_sx: e.target.value}}}})}><option>SX: Negativa</option><option>SX: Positiva</option></select>
                    </div>
                    <textarea placeholder="Movimenti..." className="input-standard h-20" value={visitData.sezione9.distretti.osteoarticolare.movimenti} onChange={e => setVisitData({...visitData, sezione9: {...visitData.sezione9, distretti: {...visitData.sezione9.distretti, osteoarticolare: {...visitData.sezione9.distretti.osteoarticolare, movimenti: e.target.value}}}})} />
                 </div>
              </div>

              {(visitData.sezione5.accertamenti.allegato_rachide || visitData.sezione5.accertamenti.strumentali.audiometria) && (
                <div className="mt-12 space-y-12 pt-12 border-t-4 border-accent/20">
                   <div className="flex items-center gap-3 text-accent"><AlertCircle size={24}/> <h2 className="text-xl font-black uppercase">Allegati Specialistici</h2></div>
                   {visitData.sezione5.accertamenti.allegato_rachide && (
                     <div className="bg-accent/5 p-10 rounded-[40px] border border-accent/10">
                        <SectionTitle num="A" title="Rachide" icon={Activity} />
                        <textarea placeholder="Conclusioni Rachide..." className="input-standard h-40" value={visitData.allegatoA.conclusioni} onChange={e => setVisitData({...visitData, allegatoA: {...visitData.allegatoA, conclusioni: e.target.value}})} />
                     </div>
                   )}
                   {visitData.sezione5.accertamenti.strumentali.audiometria && (
                     <div className="bg-tealAction/5 p-10 rounded-[40px] border border-tealAction/10">
                        <SectionTitle num="B" title="Audiometria" icon={Activity} />
                        <div className="grid grid-cols-8 gap-2">
                           {['f250', 'f500', 'f1k', 'f2k', 'f3k', 'f4k', 'f6k', 'f8k'].map(f => (
                             <input key={f} className="w-full text-center text-xs font-black py-2 rounded-xl border" placeholder={f.substring(1)} value={(visitData.allegatoB.audiogramma.dx as any)[f]} onChange={e => {
                                const val = e.target.value;
                                setVisitData(prev => ({...prev, allegatoB: {...prev.allegatoB, audiogramma: {...prev.allegatoB.audiogramma, dx: {...prev.allegatoB.audiogramma.dx, [f]: val}}}}));
                             }} />
                           ))}
                        </div>
                     </div>
                   )}
                </div>
              )}
           </div>
           <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="btn-secondary px-8 py-3"><ChevronLeft size={18}/> Indietro</button>
              <button onClick={() => setStep(5)} className="btn-teal px-12 py-4 shadow-xl">Successivo <ChevronRight size={18}/></button>
           </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <div className="glass-card p-10 rounded-[40px] border-tealAction/20 shadow-2xl">
              <SectionTitle num="11" title="Giudizio Idoneità" icon={CheckCircle} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-4">
                    {['Idoneo', 'Idoneo con prescrizioni', 'Inidoneo temporaneo'].map(g => (
                      <label key={g} className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all cursor-pointer ${visitData.sezione11.giudizio === g ? 'bg-primary/5 border-primary shadow-xl scale-[1.02]' : 'bg-white border-gray-100'}`}>
                         <input type="radio" checked={visitData.sezione11.giudizio === g} onChange={() => setVisitData({...visitData, sezione11: {...visitData.sezione11, giudizio: g}})} />
                         <span className="text-sm font-black uppercase text-primary">{g}</span>
                      </label>
                    ))}
                 </div>
                 <div className="space-y-4">
                    <textarea placeholder="Note legali e prescrizioni..." className="input-standard h-48 text-sm font-bold shadow-xl border-accent/20" value={visitData.sezione11.prescrizioni} onChange={e => setVisitData({...visitData, sezione11: {...visitData.sezione11, prescrizioni: e.target.value}})} />
                    {visitData.sezione11.giudizio.includes('temporaneo') && (
                      <div className="bg-red-50 p-6 rounded-3xl border-2 border-red-100 animate-in zoom-in duration-300">
                         <p className="text-[10px] font-black text-red-600 uppercase flex items-center gap-2"><Clock size={16} /> Richiamo Obbligatorio</p>
                         <input type="date" className="input-standard mt-4" value={visitData.sezione11.data_nuova_visita} onChange={e => setVisitData({...visitData, sezione11: {...visitData.sezione11, data_nuova_visita: e.target.value}})} />
                      </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="glass-card p-10 rounded-[40px] shadow-xl">
              <SectionTitle num="13" title="Validazione e Firme" icon={PenTool} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                 <SignatureInput label="Firma Lavoratore" onSave={sig => setVisitData({...visitData, sezione8: {...visitData.sezione8, firma: sig}})} />
                 <SignatureInput label="Firma Medico" onSave={sig => setVisitData({...visitData, sezione13: {...visitData.sezione13, firma_medico: sig}})} />
              </div>
           </div>

           <div className="flex justify-between items-center bg-sidebar p-10 rounded-[50px] shadow-2xl">
              <button onClick={() => setStep(4)} className="text-white/40 font-black uppercase text-xs hover:text-white transition flex items-center gap-2"><ChevronLeft size={16}/> Indietro</button>
              <button onClick={handleSave} className="btn-accent px-20 py-6 text-lg font-black flex items-center gap-4 shadow-[0_20px_50px_rgba(232,130,12,0.4)] hover:scale-[1.02] transition-all">
                <Download size={28} strokeWidth={3} /> FINALIZZA E ARCHIVIA
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default NuovaVisita;
