import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { Stethoscope, User, Clipboard, Activity, CheckCircle, Download, Mail, RefreshCw, Copy } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { fetchGmailMessages, type GmailMessage } from '../lib/gmail';
import { fetchGmailAttachments } from '../lib/attachments';

const NuovaVisita = () => {
  const [lavoratori, setLavoratori] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerData, setWorkerData] = useState<any>(null);
  const [step, setStep] = useState(1);

  // Gmail State
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [visitForm, setVisitForm] = useState({
    data_visita: new Date().toISOString().split('T')[0],
    tipo_visita: 'preventiva',
    anamnesi_lavorativa: '',
    anamnesi_familiare: '',
    anamnesi_patologica: '',
    esame_obiettivo: '',
    giudizio: 'idoneo',
    prescrizioni: '',
    accertamenti_effettuati: '',
    scadenza_prossima: '',
    peso: 70,
    altezza: 170,
    p_sistolica: 120,
    p_diastolica: 80,
    frequenza: 70
  });

  useEffect(() => {
    const data = executeQuery(`
      SELECT workers.id, workers.nome, workers.cognome, workers.mansione, companies.ragione_sociale as azienda
      FROM workers
      JOIN companies ON workers.company_id = companies.id
    `);
    setLavoratori(data);
  }, []);

  useEffect(() => {
    if (selectedWorkerId) {
      const data = lavoratori.find(l => l.id.toString() === selectedWorkerId);
      setWorkerData(data);

      // Auto-calculate next expiry (default 12 months)
      const nextDate = new Date();
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      setVisitForm(prev => ({...prev, scadenza_prossima: nextDate.toISOString().split('T')[0]}));
    }
  }, [selectedWorkerId, lavoratori]);

  const handleAuthAndFetch = async () => {
    const clientId = localStorage.getItem('google_client_id');
    if (!clientId) {
      alert("Configura il Client ID nelle impostazioni prima di usare Gmail.");
      return;
    }

    setLoadingGmail(true);
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: async (response: any) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            const msgs = await fetchGmailMessages(response.access_token, workerData.email);
            setGmailMessages(msgs);
          }
          setLoadingGmail(false);
        },
      });
      client.requestAccessToken();
    } catch (e) {
      console.error(e);
      setLoadingGmail(false);
    }
  };

  const importEmailText = async (msg: GmailMessage) => {
    let textToImport = `--- EMAIL del ${msg.date} ---\n${msg.body}\n`;

    if (accessToken) {
      const attachments = await fetchGmailAttachments(accessToken, msg.id);
      attachments.forEach(att => {
        if (att.extracted_text) {
          textToImport += `\n--- ALLEGATO: ${att.filename} ---\n${att.extracted_text}\n`;
        }
      });
    }

    setVisitForm(prev => ({
      ...prev,
      anamnesi_patologica: prev.anamnesi_patologica + (prev.anamnesi_patologica ? "\n\n" : "") + textToImport
    }));
    alert("Testo e allegati importati in Anamnesi Patologica!");
  };

  const handleSave = async () => {
    // 1. Insert Visit
    await runCommand(`
      INSERT INTO visits (worker_id, data_visita, tipo_visita, anamnesi_lavorativa, anamnesi_familiare, anamnesi_patologica, esame_obiettivo, giudizio, prescrizioni, scadenza_prossima, finalized)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      selectedWorkerId, visitForm.data_visita, visitForm.tipo_visita,
      visitForm.anamnesi_lavorativa, visitForm.anamnesi_familiare, visitForm.anamnesi_patologica,
      visitForm.esame_obiettivo, visitForm.giudizio, visitForm.prescrizioni, visitForm.scadenza_prossima
    ]);

    const lastVisitData = executeQuery("SELECT id FROM visits ORDER BY id DESC LIMIT 1")[0];

    // Log action for legal audit
    await runCommand(
      "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
      ["FINALIZE", "visits", lastVisitData.id, `Visita finalizzata per lavoratore ID: ${selectedWorkerId}`]
    );

    // 2. Insert Biometrics (simplified lastrowid logic for this demo since we use sql.js)
    if (lastVisitData) {
      const bmi = visitForm.peso / ((visitForm.altezza/100) ** 2);
      await runCommand(`
        INSERT INTO biometrics (visit_id, peso, altezza, bmi, pressione_sistolica, pressione_diastolica, frequenza_cardiaca)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [lastVisitData.id, visitForm.peso, visitForm.altezza, bmi, visitForm.p_sistolica, visitForm.p_diastolica, visitForm.frequenza]);
    }

    alert("Visita salvata con successo!");
    generatePDF();
    // Reset
    setStep(1);
    setSelectedWorkerId('');
  };

  const generatePDF = () => {
    const doctorData = executeQuery("SELECT * FROM doctor_profile WHERE id = 1")[0] || {};

    // 1. GIUDIZIO DI IDONEITÀ
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("GIUDIZIO DI IDONEITÀ ALLA MANSIONE SPECIFICA", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text("(D.Lgs. 81/08 e s.m.i. - Art. 41)", 105, 26, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.rect(15, 35, 180, 45);
    doc.text(`Lavoratore: ${workerData.cognome} ${workerData.nome}`, 20, 45);
    doc.text(`Codice Fiscale: ${workerData.codice_fiscale || 'N/D'}`, 20, 51);
    doc.text(`Azienda: ${workerData.azienda}`, 20, 57);
    doc.text(`Mansione: ${workerData.mansione}`, 20, 63);
    doc.text(`Data Visita: ${visitForm.data_visita}`, 20, 69);
    doc.text(`Tipo Visita: ${visitForm.tipo_visita.toUpperCase()}`, 20, 75);

    doc.setFont("helvetica", "bold");
    doc.text("GIUDIZIO:", 20, 90);
    doc.setFontSize(14);
    doc.text(visitForm.giudizio.toUpperCase(), 45, 90);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (visitForm.prescrizioni) {
      doc.text("Prescrizioni/Limitazioni:", 20, 100);
      doc.text(visitForm.prescrizioni, 20, 107, { maxWidth: 170 });
    }

    doc.text(`Prossima visita entro il: ${visitForm.scadenza_prossima}`, 20, 140);

    const signatureY = 170;
    doc.text(`Dott. ${doctorData.nome || '____________________'}`, 130, signatureY);
    doc.text(`Spec. ${doctorData.specializzazione || '____________________'}`, 130, signatureY + 6);
    doc.text(`N. Iscr. ${doctorData.n_iscrizione || '_______'}`, 130, signatureY + 12);
    doc.line(130, signatureY + 14, 190, signatureY + 14);
    doc.text("Firma del Medico Competente", 135, signatureY + 19);

    doc.save(`Giudizio_${workerData.cognome}_${visitForm.data_visita}.pdf`);

    // 2. CARTELLA SANITARIA E DI RISCHIO (ALLEGATO 3A)
    const cartella = new jsPDF();
    cartella.setFontSize(14);
    cartella.setFont("helvetica", "bold");
    cartella.text("CARTELLA SANITARIA E DI RISCHIO", 105, 20, { align: 'center' });
    cartella.setFontSize(10);
    cartella.text("(Allegato 3A - D.Lgs. 81/08)", 105, 26, { align: 'center' });

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 1: ANAGRAFICA", 15, 40);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Lavoratore: ${workerData.cognome} ${workerData.nome}`, 20, 47);
    cartella.text(`Data di nascita: ${workerData.data_nascita || 'N/D'}`, 20, 53);
    cartella.text(`Codice Fiscale: ${workerData.codice_fiscale || 'N/D'}`, 20, 59);
    cartella.text(`Azienda: ${workerData.azienda}`, 20, 65);
    cartella.text(`Mansione: ${workerData.mansione}`, 20, 71);

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 2: ANAMNESI", 15, 85);
    cartella.setFont("helvetica", "normal");
    cartella.text("Anamnesi Lavorativa:", 20, 92);
    cartella.text(visitForm.anamnesi_lavorativa || "Negativa", 25, 98, { maxWidth: 165 });
    cartella.text("Anamnesi Patologica e Familiare:", 20, 115);
    cartella.text(visitForm.anamnesi_patologica || "Negativa", 25, 121, { maxWidth: 165 });

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 3: ESAME OBIETTIVO E BIOMETRIA", 15, 150);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Peso: ${visitForm.peso}kg | Altezza: ${visitForm.altezza}cm | BMI: ${(visitForm.peso / ((visitForm.altezza/100)**2)).toFixed(1)}`, 20, 157);
    cartella.text(`Pressione: ${visitForm.p_sistolica}/${visitForm.p_diastolica} mmHg | FC: ${visitForm.frequenza} bpm`, 20, 163);
    cartella.text("Esame Obiettivo:", 20, 170);
    cartella.text(visitForm.esame_obiettivo || "Regolare", 25, 176, { maxWidth: 165 });

    cartella.setFont("helvetica", "bold");
    cartella.text("ACCERTAMENTI STRUMENTALI:", 20, 200);
    cartella.setFont("helvetica", "normal");
    cartella.text(visitForm.accertamenti_effettuati || "Non eseguiti", 25, 206, { maxWidth: 165 });

    cartella.setFont("helvetica", "bold");
    cartella.text("SEZIONE 4: GIUDIZIO DI IDONEITA", 15, 200);
    cartella.setFont("helvetica", "normal");
    cartella.text(`Giudizio: ${visitForm.giudizio.toUpperCase()}`, 20, 207);
    cartella.text(`Scadenza: ${visitForm.scadenza_prossima}`, 20, 213);

    cartella.save(`Cartella_3A_${workerData.cognome}_${visitForm.data_visita}.pdf`);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-8">
        <Stethoscope className="text-blue-600" /> Nuova Visita Medica (Allegato 3A)
      </h1>

      {/* Progress Stepper */}
      <div className="flex items-center mb-10">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex flex-1 items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition ${
              step >= s ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-400'
            }`}>
              {step > s ? <CheckCircle size={20} /> : s}
            </div>
            {s < 4 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2"><User className="text-blue-500" /> Selezione Lavoratore</h2>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-600">Scegli il lavoratore per iniziare la visita</label>
              <select
                className="border border-gray-300 rounded-xl p-3 text-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedWorkerId}
                onChange={e => setSelectedWorkerId(e.target.value)}
              >
                <option value="">-- Seleziona --</option>
                {lavoratori.map(l => (
                  <option key={l.id} value={l.id}>{l.cognome} {l.nome} ({l.azienda})</option>
                ))}
              </select>
            </div>
            {workerData && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                <div>
                  <p className="text-blue-800 font-bold">{workerData.azienda}</p>
                  <p className="text-blue-600 text-sm">Mansione: {workerData.mansione}</p>
                </div>
                <button onClick={() => setStep(2)} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Procedi</button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Clipboard className="text-blue-500" /> Anamnesi e Biometria</h2>

            {/* Gmail Import Section */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-orange-800 font-bold flex items-center gap-2 text-sm">
                  <Mail size={16} /> ACQUISIZIONE DOCUMENTI DA GMAIL ({workerData.email})
                </h3>
                <button
                  onClick={handleAuthAndFetch}
                  disabled={loadingGmail || !workerData.email}
                  className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingGmail ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  Sincronizza Mail Paziente
                </button>
              </div>

              {gmailMessages.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {gmailMessages.map(msg => (
                    <div key={msg.id} className="bg-white p-3 rounded-lg border border-orange-200 text-xs flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="font-bold text-gray-700">{msg.date}</div>
                        <div className="text-gray-500 line-clamp-2 italic">"{msg.snippet}"</div>
                      </div>
                      <button
                        onClick={() => importEmailText(msg)}
                        className="text-orange-600 hover:bg-orange-50 p-2 rounded-md border border-orange-200 flex items-center gap-1 font-bold whitespace-nowrap"
                      >
                        <Copy size={14} /> Importa in Anamnesi
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-orange-600 italic">Nessuna comunicazione recente trovata o sincronizzazione non avviata.</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Anamnesi Lavorativa</label>
                  <textarea className="border border-gray-300 rounded-md p-2 h-20" value={visitForm.anamnesi_lavorativa} onChange={e => setVisitForm({...visitForm, anamnesi_lavorativa: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Anamnesi Familiare e Patologica</label>
                  <textarea className="border border-gray-300 rounded-md p-2 h-20" value={visitForm.anamnesi_patologica} onChange={e => setVisitForm({...visitForm, anamnesi_patologica: e.target.value})} />
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                <p className="font-semibold text-sm text-gray-500 uppercase">Parametri Biometrici</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs">Peso (kg)</label>
                    <input type="number" className="border rounded p-1" value={visitForm.peso} onChange={e => setVisitForm({...visitForm, peso: parseFloat(e.target.value)})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs">Altezza (cm)</label>
                    <input type="number" className="border rounded p-1" value={visitForm.altezza} onChange={e => setVisitForm({...visitForm, altezza: parseInt(e.target.value)})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs">PA Sistolica</label>
                    <input type="number" className="border rounded p-1" value={visitForm.p_sistolica} onChange={e => setVisitForm({...visitForm, p_sistolica: parseInt(e.target.value)})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs">PA Diastolica</label>
                    <input type="number" className="border rounded p-1" value={visitForm.p_diastolica} onChange={e => setVisitForm({...visitForm, p_diastolica: parseInt(e.target.value)})} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setStep(1)} className="text-gray-500">Indietro</button>
              <button onClick={() => setStep(3)} className="bg-blue-600 text-white px-8 py-2 rounded-lg">Procedi</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Activity className="text-blue-500" /> Esame Obiettivo e Accertamenti</h2>
            <div className="grid grid-cols-1 gap-6">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Accertamenti Strumentali Effettuati</label>
                <textarea
                  placeholder="es. Audiometria (normale), Spirometria (FVC 95%), ECG (ritmo sinusale)..."
                  className="border border-gray-300 rounded-md p-2 h-24"
                  value={visitForm.accertamenti_effettuati}
                  onChange={e => setVisitForm({...visitForm, accertamenti_effettuati: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Risultanze Esame Obiettivo</label>
                <textarea
                  placeholder="es. Torace normoconformato, MV presente su tutto l'ambito, toni cardiaci puri..."
                  className="border border-gray-300 rounded-md p-2 h-40"
                  value={visitForm.esame_obiettivo}
                  onChange={e => setVisitForm({...visitForm, esame_obiettivo: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setStep(2)} className="text-gray-500">Indietro</button>
              <button onClick={() => setStep(4)} className="bg-blue-600 text-white px-8 py-2 rounded-lg">Procedi al Giudizio</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-blue-700">Finalizzazione Giudizio di Idoneità</h2>
            <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-gray-700">Giudizio Finale</label>
                  <select
                    className="border border-gray-300 rounded-lg p-2 bg-white"
                    value={visitForm.giudizio}
                    onChange={e => setVisitForm({...visitForm, giudizio: e.target.value})}
                  >
                    <option value="idoneo">IDONEO</option>
                    <option value="idoneo con prescrizioni">IDONEO CON PRESCRIZIONI</option>
                    <option value="idoneo con limitazioni">IDONEO CON LIMITAZIONI</option>
                    <option value="non idoneo temporaneo">NON IDONEO TEMPORANEO</option>
                    <option value="non idoneo permanente">NON IDONEO PERMANENTE</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-gray-700">Scadenza Prossima Visita</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-lg p-2 bg-white"
                    value={visitForm.scadenza_prossima}
                    onChange={e => setVisitForm({...visitForm, scadenza_prossima: e.target.value})}
                  />
                </div>
                <div className="col-span-full flex flex-col gap-2">
                  <label className="font-bold text-gray-700">Note e Prescrizioni</label>
                  <textarea
                    className="border border-gray-300 rounded-lg p-2 h-24 bg-white"
                    placeholder="Dettagliare eventuali prescrizioni o limitazioni..."
                    value={visitForm.prescrizioni}
                    onChange={e => setVisitForm({...visitForm, prescrizioni: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center mt-10">
              <button onClick={() => setStep(3)} className="text-gray-500">Indietro</button>
              <div className="flex gap-4">
                <button onClick={handleSave} className="bg-green-600 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 shadow-lg">
                  <Download size={20} /> Salva e Genera PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NuovaVisita;
