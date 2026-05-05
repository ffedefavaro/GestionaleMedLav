import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand, runCommands } from '../lib/db';
import {
  Plus, Search, Edit2, Trash2, Building2, MapPin,
  ClipboardList, Copy, Shield, AlertCircle, Download,
  ListChecks, X, ChevronDown, ChevronUp, Users, Briefcase,
  ChevronRight
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Exam {
  nome: string;
  periodicita: number;
  obbligatorio: boolean;
}

const Aziende = () => {
  const [aziende, setAziende] = useState<any[]>([]);
  const [protocolli, setProtocolli] = useState<any[]>([]);
  const [rischiMaster, setRischiMaster] = useState<any[]>([]);
  const [examsMaster, setExamsMaster] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showProtocolForm, setShowProtocolForm] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [protocolToClone, setProtocolToClone] = useState<any>(null);
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [editingProtocolId, setEditingProtocolId] = useState<number | null>(null);
  const [showExamsModal, setShowExamsModal] = useState(false);
  const [exams, setExams] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFormData, setCompanyFormData] = useState({
    ragione_sociale: '',
    p_iva: '',
    ateco: '',
    sede_operativa: '',
    referente: '',
    rspp: '',
    rls: ''
  });

  const [protocolFormData, setProtocolFormData] = useState({
    company_id: '',
    mansione: '',
    homogeneous_group: '',
    risks: [] as string[],
    esami: [] as Exam[],
    periodicita_mesi: 12,
    is_customizable: 1
  });

  const [expandedProtocols, setExpandedProtocols] = useState<number[]>([]);

  const fetchData = () => {
    const data = executeQuery("SELECT * FROM companies ORDER BY ragione_sociale ASC");
    const p = executeQuery(`
      SELECT
        protocols.*,
        companies.ragione_sociale as azienda,
        (SELECT COUNT(*) FROM workers WHERE workers.protocol_id = protocols.id) as num_lavoratori
      FROM protocols
      JOIN companies ON protocols.company_id = companies.id
      ORDER BY mansione ASC
    `);
    const r = executeQuery("SELECT * FROM risks_master ORDER BY categoria, nome");
    const e = executeQuery("SELECT * FROM exams_master ORDER BY nome");

    setAziende(data);
    setProtocolli(p.map(item => ({
      ...item,
      risks: JSON.parse(item.risks || '[]'),
      esami: JSON.parse(item.esami || '[]')
    })));
    setRischiMaster(r);
    setExamsMaster(e);
  };

  const fetchExams = () => {
    const data = executeQuery("SELECT * FROM exams_master ORDER BY nome ASC");
    setExams(data);
  };

  useEffect(() => {
    fetchData();
    fetchExams();
  }, []);

  const handleUpdateExamCost = async (id: number, cost: string) => {
    const numCost = cost === '' ? null : parseFloat(cost);
    await runCommand("UPDATE exams_master SET costo_base = ? WHERE id = ?", [numCost, id]);
    fetchExams();
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Sei sicuro di voler eliminare l'azienda ${name}? Questa azione eliminerà anche tutti i protocolli associati.`)) {
      await runCommand("DELETE FROM companies WHERE id = ?", [id]);
      await runCommand("INSERT INTO audit_logs (action, table_name, details) VALUES (?, ?, ?)",
        ["DELETE", "companies", `Eliminata azienda: ${name} (ID: ${id})`]);
      fetchData();
    }
  };

  const handleEdit = (azienda: any) => {
    setCompanyFormData({
      ragione_sociale: azienda.ragione_sociale,
      p_iva: azienda.p_iva || '',
      ateco: azienda.ateco || '',
      sede_operativa: azienda.sede_operativa || '',
      referente: azienda.referente || '',
      rspp: azienda.rspp || '',
      rls: azienda.rls || ''
    });
    setEditingId(azienda.id);
    setShowForm(true);
  };

  const [editingId, setEditingId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await runCommand(
        `UPDATE companies SET ragione_sociale = ?, p_iva = ?, ateco = ?, sede_operativa = ?, referente = ?, rspp = ?, rls = ? WHERE id = ?`,
        [companyFormData.ragione_sociale, companyFormData.p_iva, companyFormData.ateco, companyFormData.sede_operativa, companyFormData.referente, companyFormData.rspp, companyFormData.rls, editingId]
      );
    } else {
      await runCommand(
        `INSERT INTO companies (ragione_sociale, p_iva, ateco, sede_operativa, referente, rspp, rls)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [companyFormData.ragione_sociale, companyFormData.p_iva, companyFormData.ateco, companyFormData.sede_operativa, companyFormData.referente, companyFormData.rspp, companyFormData.rls]
      );
    }

    // Audit log for legal compliance
    await runCommand("INSERT INTO audit_logs (action, table_name, details) VALUES (?, ?, ?)",
      ["INSERT", "companies", `Nuova azienda: ${companyFormData.ragione_sociale}`]);

    setShowForm(false);
    setEditingId(null);
    setCompanyFormData({ ragione_sociale: '', p_iva: '', ateco: '', sede_operativa: '', referente: '', rspp: '', rls: '' });
    fetchData();
  };

  const handleAddExam = (examName: string) => {
    if (!examName) return;
    if (protocolFormData.esami.find(e => e.nome === examName)) return;
    setProtocolFormData({
      ...protocolFormData,
      esami: [...protocolFormData.esami, { nome: examName, periodicita: protocolFormData.periodicita_mesi, obbligatorio: true }]
    });
  };

  const removeExam = (index: number) => {
    const newExams = [...protocolFormData.esami];
    newExams.splice(index, 1);
    setProtocolFormData({ ...protocolFormData, esami: newExams });
  };

  const updateExam = (index: number, field: keyof Exam, value: any) => {
    const newExams = [...protocolFormData.esami];
    newExams[index] = { ...newExams[index], [field]: value };
    setProtocolFormData({ ...protocolFormData, esami: newExams });
  };

  const recalculateDeadlines = async (protocolId: number, esami: Exam[], periodicitaMesi: number) => {
    const workers = executeQuery("SELECT id FROM workers WHERE protocol_id = ?", [protocolId]);
    const commands: { sql: string, params: any[] }[] = [];
    let updatedCount = 0;

    const minMonths = Math.min(...esami.map(e => e.periodicita), periodicitaMesi);

    for (const worker of workers) {
      const lastVisit = executeQuery(
        "SELECT data_visita, scadenza_prossima FROM visits WHERE worker_id = ? ORDER BY data_visita DESC LIMIT 1",
        [worker.id]
      )[0];

      if (lastVisit) {
        const lastDate = new Date(lastVisit.data_visita);
        const newExpiry = new Date(lastDate);
        newExpiry.setMonth(newExpiry.getMonth() + minMonths);
        const newExpiryStr = newExpiry.toISOString().split('T')[0];

        if (newExpiryStr !== lastVisit.scadenza_prossima) {
          commands.push({
            sql: "UPDATE visits SET scadenza_prossima = ? WHERE worker_id = ? AND data_visita = ?",
            params: [newExpiryStr, worker.id, lastVisit.data_visita]
          });

          commands.push({
            sql: "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
            params: ["UPDATE_EXPIRY", "visits", worker.id, `Ricalcolo scadenza per cambio protocollo: da ${lastVisit.scadenza_prossima} a ${newExpiryStr}`]
          });

          updatedCount++;
        }
      }
    }

    if (commands.length > 0) {
      await runCommands(commands);
    }

    return updatedCount;
  };

  const generateProtocolPDF = (p: any) => {
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PROTOCOLLO DI SORVEGLIANZA SANITARIA", 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Azienda: ${p.azienda}`, 20, 35);
    doc.text(`Mansione: ${p.mansione}`, 20, 41);

    doc.line(20, 52, 190, 52);

    doc.setFont("helvetica", "bold");
    doc.text("FATTORI DI RISCHIO ASSOCIATI:", 20, 60);
    doc.setFont("helvetica", "normal");
    doc.text(p.risks.join(', ') || 'Nessuno', 25, 67, { maxWidth: 165 });

    doc.setFont("helvetica", "bold");
    doc.text("PIANO DEGLI ACCERTAMENTI:", 20, 85);

    let y = 95;
    p.esami.forEach((e: Exam) => {
      doc.setFont("helvetica", "normal");
      doc.text(`- ${e.nome} (${e.periodicita} mesi) - ${e.obbligatorio ? 'Obbligatorio' : 'Consigliato'}`, 25, y);
      y += 8;
    });

    // Firma e timbro
    const pageHeight = doc.internal.pageSize.height;
    y = pageHeight - 60;
    doc.line(20, y, 90, y);
    doc.line(120, y, 190, y);

    doc.setFontSize(8);
    doc.text("Firma del Medico Competente", 55, y + 5, { align: 'center' });
    doc.text("Firma del Datore di Lavoro", 155, y + 5, { align: 'center' });

    doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 20, y + 15);
    doc.text("Timbro dell'Azienda", 120, y + 15);

    doc.save(`Protocollo_${p.azienda}_${p.mansione}.pdf`);
  };

  const confirmClone = () => {
    if (!targetCompanyId || !protocolToClone) return;

    setProtocolFormData({
      ...protocolToClone,
      company_id: targetCompanyId,
      mansione: `${protocolToClone.mansione} (Copia)`,
      risks: protocolToClone.risks,
      esami: protocolToClone.esami
    });
    setEditingProtocolId(null);
    setShowCloneModal(false);
    setShowProtocolForm(true);
  };

  const handleSubmitProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProtocolId) {
      await runCommand(
        `UPDATE protocols SET
          company_id = ?, mansione = ?, homogeneous_group = ?,
          risks = ?, esami = ?, periodicita_mesi = ?, is_customizable = ?
        WHERE id = ?`,
        [
          protocolFormData.company_id, protocolFormData.mansione, protocolFormData.homogeneous_group,
          JSON.stringify(protocolFormData.risks), JSON.stringify(protocolFormData.esami),
          protocolFormData.periodicita_mesi, protocolFormData.is_customizable, editingProtocolId
        ]
      );

      const updatedCount = await recalculateDeadlines(editingProtocolId, protocolFormData.esami, protocolFormData.periodicita_mesi);
      if (updatedCount > 0) {
        alert(`Protocollo aggiornato. Ricalcolate le scadenze per ${updatedCount} lavoratori.`);
      }
    } else {
      await runCommand(
        `INSERT INTO protocols (company_id, mansione, homogeneous_group, risks, esami, periodicita_mesi, is_customizable)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          protocolFormData.company_id, protocolFormData.mansione, protocolFormData.homogeneous_group,
          JSON.stringify(protocolFormData.risks), JSON.stringify(protocolFormData.esami),
          protocolFormData.periodicita_mesi, protocolFormData.is_customizable
        ]
      );
    }

    setShowProtocolForm(false);
    setEditingProtocolId(null);
    fetchData();
  };

  const filtered = aziende.filter(a =>
    a.ragione_sociale.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.p_iva.includes(searchTerm)
  );

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight">Gestione Aziende</h1>
          <p className="text-gray-500 font-medium mt-1">Anagrafica clienti e sedi operative</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setShowExamsModal(true)}
            className="px-6 py-3 rounded-2xl bg-primary/5 text-primary font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-primary/10 transition-all"
          >
            <ClipboardList size={18} /> Listino Accertamenti
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-accent flex items-center gap-3"
          >
            <Plus size={20} strokeWidth={3} /> Nuova Azienda
          </button>
        </div>
      </div>

      {showExamsModal && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-10 max-w-2xl w-full shadow-2xl border border-white max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-primary tracking-tight">Listino Accertamenti</h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Configurazione costi base</p>
              </div>
              <button onClick={() => setShowExamsModal(false)} className="text-gray-300 hover:text-accent transition-colors"><X size={28} /></button>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
              <table className="w-full">
                <thead className="sticky top-0 bg-white z-10 border-b border-gray-100">
                  <tr>
                    <th className="py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Accertamento</th>
                    <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Costo Base €</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {exams.map((exam) => (
                    <tr key={exam.id} className="group hover:bg-primary/5 transition-colors">
                      <td className="py-4">
                        <div className="font-black text-primary text-sm uppercase tracking-tight">{exam.nome}</div>
                        <div className="text-[10px] text-gray-400 font-bold">{exam.descrizione}</div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="--"
                            className="w-24 bg-warmWhite/50 border border-gray-100 rounded-xl p-2 text-right text-sm font-black outline-none focus:border-primary transition-all"
                            value={exam.costo_base ?? ''}
                            onChange={(e) => {
                              const newExams = exams.map(ex => ex.id === exam.id ? { ...ex, costo_base: e.target.value } : ex);
                              setExams(newExams);
                            }}
                            onBlur={(e) => handleUpdateExamCost(exam.id, e.target.value)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowExamsModal(false)}
                className="btn-primary px-10 py-3"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="glass-card p-10 rounded-[40px] mb-12 border-2 border-primary/5 animate-in fade-in zoom-in duration-300">
          <h2 className="text-2xl font-black text-primary mb-8 flex items-center gap-3">
             <Building2 className="text-accent" /> Configurazione Anagrafica
          </h2>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="flex flex-col gap-2 col-span-full">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ragione Sociale</label>
                <input
                  required
                  placeholder="es. Rossi Costruzioni S.p.A."
                  className="input-standard text-lg"
                  value={companyFormData.ragione_sociale}
                  onChange={e => setCompanyFormData({...companyFormData, ragione_sociale: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Partita IVA / CF</label>
                <input
                  className="input-standard"
                  value={companyFormData.p_iva}
                  onChange={e => setCompanyFormData({...companyFormData, p_iva: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Codice ATECO</label>
                <input
                  className="input-standard font-mono"
                  value={companyFormData.ateco}
                  onChange={e => setCompanyFormData({...companyFormData, ateco: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sede Operativa</label>
                <input
                  className="input-standard"
                  value={companyFormData.sede_operativa}
                  onChange={e => setCompanyFormData({...companyFormData, sede_operativa: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Referente Aziendale</label>
                <input
                  className="input-standard"
                  value={companyFormData.referente}
                  onChange={e => setCompanyFormData({...companyFormData, referente: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">RSPP Nominato</label>
                <input
                  className="input-standard"
                  value={companyFormData.rspp}
                  onChange={e => setCompanyFormData({...companyFormData, rspp: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">RLS</label>
                <input
                  className="input-standard"
                  value={companyFormData.rls}
                  onChange={e => setCompanyFormData({...companyFormData, rls: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-8 py-3 text-gray-400 font-bold hover:text-primary transition"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="btn-accent px-12 py-3 shadow-2xl shadow-accent/20"
              >
                Salva Azienda
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card rounded-[40px] overflow-hidden p-2 shadow-2xl border border-white">
        <div className="p-8 flex items-center gap-6 bg-warmWhite/20 border-b border-gray-100/50">
          <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-100 flex items-center gap-4 flex-1 max-w-xl">
            <Search className="text-gray-300" size={24} />
            <input
              placeholder="Cerca per ragione sociale o P.IVA..."
              className="flex-1 bg-transparent outline-none text-primary font-black placeholder:text-gray-300"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-medical">
            <thead>
              <tr>
                <th>Ragione Sociale</th>
                <th>Dati Fiscali</th>
                <th>Sede</th>
                <th>Staff Sicurezza</th>
                <th className="text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((azienda) => (
                <React.Fragment key={azienda.id}>
                <tr className={`group transition-colors ${selectedCompanyId === azienda.id ? 'bg-primary/5' : ''}`}>
                  <td className="font-black text-primary text-base tracking-tight">{azienda.ragione_sociale}</td>
                  <td>
                    <div className="flex flex-col">
                       <span className="font-mono text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">P.IVA / CF</span>
                       <span className="text-sm font-bold text-gray-600">{azienda.p_iva}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 text-gray-500 font-bold">
                       <MapPin size={14} className="text-gray-300" />
                       {azienda.sede_operativa || 'N/D'}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black text-tealAction uppercase tracking-tighter bg-tealAction/5 px-2 rounded">RSPP</span>
                         <span className="text-xs font-bold text-gray-600">{azienda.rspp || '---'}</span>
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black text-accent uppercase tracking-tighter bg-accent/5 px-2 rounded">RLS</span>
                         <span className="text-xs font-bold text-gray-600">{azienda.rls || '---'}</span>
                       </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setSelectedCompanyId(selectedCompanyId === azienda.id ? null : azienda.id)}
                        className={`p-3 rounded-2xl transition-all flex items-center gap-2 ${selectedCompanyId === azienda.id ? 'bg-primary text-white shadow-lg' : 'hover:bg-primary/10 text-primary'}`}
                      >
                        <ClipboardList size={18} />
                        <span className="text-[10px] font-black uppercase">Mansioni</span>
                      </button>
                      <button
                        onClick={() => handleEdit(azienda)}
                        className="p-3 hover:bg-tealAction/10 text-tealAction rounded-2xl transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(azienda.id, azienda.ragione_sociale)}
                        className="p-3 hover:bg-accent/10 text-accent rounded-2xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
                {selectedCompanyId === azienda.id && (
                  <tr>
                    <td colSpan={5} className="p-0 bg-warmWhite/30">
                      <div className="p-10 border-x-2 border-b-2 border-primary/10 rounded-b-[40px] animate-in slide-in-from-top-4 duration-300">
                        <div className="flex justify-between items-center mb-8">
                          <div>
                            <h3 className="text-2xl font-black text-primary tracking-tight">Mansioni e Protocolli</h3>
                            <p className="text-gray-500 font-medium text-sm">Configurazione sorveglianza sanitaria per {azienda.ragione_sociale}</p>
                          </div>
                          <button
                            onClick={() => {
                              setProtocolFormData({
                                company_id: azienda.id.toString(),
                                mansione: '',
                                homogeneous_group: '',
                                risks: [],
                                esami: [],
                                periodicita_mesi: 12,
                                is_customizable: 1
                              });
                              setEditingProtocolId(null);
                              setShowProtocolForm(true);
                            }}
                            className="btn-teal flex items-center gap-3 py-3 px-6"
                          >
                            <Plus size={18} strokeWidth={3} /> Aggiungi Mansione
                          </button>
                        </div>

                        <div className="space-y-4">
                          {protocolli.filter(p => p.company_id === azienda.id).length === 0 ? (
                            <div className="bg-white p-12 rounded-[32px] text-center border-2 border-dashed border-gray-100">
                              <Briefcase size={40} className="mx-auto text-gray-200 mb-4" />
                              <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Nessuna mansione configurata per questa azienda</p>
                            </div>
                          ) : (
                            <div className="grid gap-4">
                              {protocolli.filter(p => p.company_id === azienda.id).map(protocol => (
                                <div key={protocol.id} className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                  <div
                                    onClick={() => {
                                      setExpandedProtocols(prev =>
                                        prev.includes(protocol.id)
                                          ? prev.filter(id => id !== protocol.id)
                                          : [...prev, protocol.id]
                                      );
                                    }}
                                    className="p-6 flex items-center justify-between cursor-pointer"
                                  >
                                    <div className="flex items-center gap-6">
                                      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                                        <Briefcase size={24} />
                                      </div>
                                      <div>
                                        <div className="font-black text-primary text-lg leading-tight">{protocol.mansione}</div>
                                        <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">{protocol.homogeneous_group || 'Standard'}</div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-12">
                                      <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Lavoratori</span>
                                          <span className="text-sm font-black text-primary">{protocol.num_lavoratori} assegnati</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-xl bg-tealAction/5 flex items-center justify-center text-tealAction">
                                          <Users size={16} />
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Accertamenti</span>
                                          <span className="text-sm font-black text-primary">{protocol.esami.length} previsti</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                                          <ListChecks size={16} />
                                        </div>
                                      </div>
                                      <div className="text-gray-300">
                                        {expandedProtocols.includes(protocol.id) ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                      </div>
                                    </div>
                                  </div>

                                  {expandedProtocols.includes(protocol.id) && (
                                    <div className="px-6 pb-6 pt-2 border-t border-gray-50 animate-in fade-in duration-300">
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-6">
                                        {/* Clinical Info */}
                                        <div className="space-y-8">
                                          <section>
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                              <Shield size={14} className="text-tealAction" /> Fattori di Rischio (D.Lgs. 81/08)
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                              {protocol.risks.map((r: string, i: number) => (
                                                <span key={i} className="bg-primary/5 text-primary px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter border border-primary/5">
                                                  {r}
                                                </span>
                                              ))}
                                              {protocol.risks.length === 0 && <p className="text-xs text-gray-400 italic">Nessun rischio associato</p>}
                                            </div>
                                          </section>

                                          <section>
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                              <ListChecks size={14} className="text-tealAction" /> Piano Accertamenti
                                            </h4>
                                            <div className="bg-warmWhite/30 rounded-[24px] border border-gray-100 overflow-hidden">
                                              <table className="w-full text-left">
                                                <thead className="bg-gray-50/50">
                                                  <tr>
                                                    <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase">Esame</th>
                                                    <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase text-center">Periodicità</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                  {protocol.esami.map((e: any, i: number) => (
                                                    <tr key={i}>
                                                      <td className="px-6 py-3 text-xs font-black text-primary uppercase">{e.nome}</td>
                                                      <td className="px-6 py-3 text-xs font-bold text-gray-500 text-center">{e.periodicita} mesi</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </section>
                                        </div>

                                        {/* Workers list */}
                                        <div className="space-y-4">
                                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Users size={14} className="text-tealAction" /> Lavoratori Assegnati
                                          </h4>
                                          <div className="max-h-[300px] overflow-y-auto custom-scrollbar bg-warmWhite/30 rounded-[32px] p-2 border border-gray-100">
                                            {(() => {
                                              const protocolWorkers = executeQuery(
                                                "SELECT nome, cognome, codice_fiscale FROM workers WHERE protocol_id = ? ORDER BY cognome ASC",
                                                [protocol.id]
                                              );
                                              return protocolWorkers.length === 0 ? (
                                                <p className="p-10 text-center text-xs text-gray-400 italic">Nessun lavoratore assegnato</p>
                                              ) : (
                                                <div className="space-y-2">
                                                  {protocolWorkers.map((w: any, idx) => (
                                                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-50 flex justify-between items-center">
                                                      <div>
                                                        <div className="font-black text-primary text-sm">{w.cognome} {w.nome}</div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase">{w.codice_fiscale}</div>
                                                      </div>
                                                      <div className="w-8 h-8 rounded-full bg-tealAction/5 flex items-center justify-center text-tealAction">
                                                        <ChevronRight size={14} />
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              );
                                            })()}
                                          </div>

                                          <div className="flex justify-end gap-2 pt-6">
                                            <button
                                              onClick={() => {
                                                setProtocolFormData({
                                                  company_id: protocol.company_id.toString(),
                                                  mansione: protocol.mansione,
                                                  homogeneous_group: protocol.homogeneous_group || '',
                                                  risks: protocol.risks,
                                                  esami: protocol.esami,
                                                  periodicita_mesi: protocol.periodicita_mesi,
                                                  is_customizable: protocol.is_customizable
                                                });
                                                setEditingProtocolId(protocol.id);
                                                setShowProtocolForm(true);
                                              }}
                                              className="p-3 hover:bg-primary/5 text-gray-400 hover:text-primary rounded-2xl transition-all"
                                              title="Modifica"
                                            >
                                              <Edit2 size={18} />
                                            </button>
                                            <button
                                              onClick={() => generateProtocolPDF(protocol)}
                                              className="p-3 hover:bg-primary/5 text-gray-400 hover:text-primary rounded-2xl transition-all"
                                              title="Scarica PDF"
                                            >
                                              <Download size={18} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setProtocolToClone(protocol);
                                                setTargetCompanyId('');
                                                setShowCloneModal(true);
                                              }}
                                              className="p-3 hover:bg-tealAction/5 text-gray-400 hover:text-tealAction rounded-2xl transition-all"
                                              title="Clona"
                                            >
                                              <Copy size={18} />
                                            </button>
                                            <button
                                              onClick={async () => {
                                                if (confirm("Sei sicuro di voler eliminare questa mansione?")) {
                                                  await runCommand("DELETE FROM protocols WHERE id = ?", [protocol.id]);
                                                  fetchData();
                                                }
                                              }}
                                              className="p-3 hover:bg-accent/10 text-accent rounded-2xl transition-all"
                                              title="Elimina"
                                            >
                                              <Trash2 size={18} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-20 text-center">
             <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <Building2 size={32} className="text-primary/10" />
            </div>
            <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Nessuna azienda nel database</p>
          </div>
        )}
      </div>
      {/* Modal Clonazione */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-white">
            <h3 className="text-xl font-black text-primary mb-6">Clona Mansione</h3>
            <p className="text-sm text-gray-500 mb-6">Seleziona l'azienda di destinazione per la copia della mansione <strong>{protocolToClone?.mansione}</strong>.</p>

            <div className="flex flex-col gap-2 mb-8">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Azienda di Destinazione</label>
              <select
                required
                className="input-standard"
                value={targetCompanyId}
                onChange={e => setTargetCompanyId(e.target.value)}
              >
                <option value="">Seleziona Azienda...</option>
                {aziende.map(a => <option key={a.id} value={a.id}>{a.ragione_sociale}</option>)}
              </select>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowCloneModal(false)} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors">Annulla</button>
              <button onClick={confirmClone} disabled={!targetCompanyId} className="flex-[2] btn-teal py-3 shadow-xl disabled:opacity-50">Conferma Copia</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Protocollo Form */}
      {showProtocolForm && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[40px] p-10 max-w-5xl w-full shadow-2xl border border-white my-8">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-black text-primary flex items-center gap-3">
                 <Shield className="text-tealAction" /> {editingProtocolId ? 'Modifica Mansione' : 'Nuova Mansione'}
               </h2>
               <button onClick={() => setShowProtocolForm(false)} className="text-gray-400 hover:text-accent transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmitProtocol} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Mansione</label>
                  <input
                    required
                    placeholder="es. Magazziniere carrellista"
                    className="input-standard"
                    value={protocolFormData.mansione}
                    onChange={e => setProtocolFormData({...protocolFormData, mansione: e.target.value})}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Gruppo Omogeneo</label>
                  <input
                    placeholder="es. Area Logistica"
                    className="input-standard"
                    value={protocolFormData.homogeneous_group}
                    onChange={e => setProtocolFormData({...protocolFormData, homogeneous_group: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-tealAction" /> Fattori di Rischio Associati (DVR)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 bg-warmWhite/30 p-6 rounded-[24px] border border-gray-100 shadow-inner">
                  {rischiMaster.map(r => (
                    <label key={r.id} className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                      protocolFormData.risks.includes(r.nome) ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-gray-500 border-gray-100 hover:border-primary/20'
                    }`}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={protocolFormData.risks.includes(r.nome)}
                        onChange={e => {
                          if (e.target.checked) setProtocolFormData({...protocolFormData, risks: [...protocolFormData.risks, r.nome]});
                          else setProtocolFormData({...protocolFormData, risks: protocolFormData.risks.filter(x => x !== r.nome)});
                        }}
                      />
                      <span className="text-[11px] font-black leading-tight uppercase tracking-tighter">{r.nome}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <ListChecks size={16} className="text-tealAction" /> Protocollo Sanitario - Esami
                  </label>
                  <div className="flex items-center gap-3 bg-primary/5 px-4 py-2 rounded-xl">
                     <span className="text-[10px] font-black text-primary uppercase">Periodicità Standard (mesi)</span>
                     <input
                      type="number"
                      className="w-12 bg-transparent text-sm font-black text-primary outline-none"
                      value={protocolFormData.periodicita_mesi}
                      onChange={e => setProtocolFormData({...protocolFormData, periodicita_mesi: parseInt(e.target.value)})}
                     />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div className="bg-warmWhite/50 p-6 rounded-[24px] border border-gray-100 space-y-3">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Seleziona Esame</p>
                    <div className="space-y-1 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {examsMaster.map(ex => (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => handleAddExam(ex.nome)}
                          className="w-full text-left p-3 text-[11px] font-black text-gray-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-all flex justify-between items-center group uppercase tracking-tighter"
                        >
                          {ex.nome}
                          <Plus size={14} className="opacity-0 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-3 bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-xl shadow-primary/5">
                     <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Esame</th>
                            <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Mesi</th>
                            <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Obbl.</th>
                            <th className="px-6 py-4"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {protocolFormData.esami.map((exam, idx) => (
                            <tr key={idx} className="group hover:bg-primary/5 transition-colors">
                              <td className="px-6 py-4 text-xs font-black text-primary uppercase">{exam.nome}</td>
                              <td className="px-6 py-4">
                                <input
                                  type="number"
                                  className="w-16 bg-warmWhite/50 border border-gray-100 rounded-lg p-2 text-xs font-black outline-none focus:border-primary"
                                  value={exam.periodicita}
                                  onChange={e => updateExam(idx, 'periodicita', parseInt(e.target.value))}
                                />
                              </td>
                              <td className="px-6 py-4">
                                  <input
                                    type="checkbox"
                                    checked={exam.obbligatorio}
                                    onChange={e => updateExam(idx, 'obbligatorio', e.target.checked)}
                                    className="w-4 h-4 rounded text-tealAction"
                                  />
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button type="button" onClick={() => removeExam(idx)} className="p-2 text-gray-300 hover:text-accent transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                     </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-8 border-t border-gray-100">
                <button
                  type="submit"
                  className="btn-teal px-16 py-4 shadow-2xl"
                >
                  {editingProtocolId ? 'Aggiorna Mansione' : 'Salva Mansione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Aziende;
