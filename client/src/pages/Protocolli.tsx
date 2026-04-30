import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import {
  ClipboardList, Plus, Trash2, Copy, Shield,
  AlertCircle, Download, ListChecks, Search, Edit2
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Exam {
  nome: string;
  periodicita: number;
  obbligatorio: boolean;
}

const Protocolli = () => {
  const [protocolli, setProtocolli] = useState<any[]>([]);
  const [aziende, setAziende] = useState<any[]>([]);
  const [rischiMaster, setRischiMaster] = useState<any[]>([]);
  const [examsMaster, setExamsMaster] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    company_id: '',
    mansione: '',
    homogeneous_group: '',
    risks: [] as string[],
    esami: [] as Exam[],
    periodicita_mesi: 12,
    is_customizable: 1
  });

  const fetchData = () => {
    const p = executeQuery(`
      SELECT
        protocols.*,
        companies.ragione_sociale as azienda,
        (SELECT COUNT(*) FROM workers WHERE workers.protocol_id = protocols.id) as num_lavoratori
      FROM protocols
      JOIN companies ON protocols.company_id = companies.id
      ORDER BY azienda ASC, mansione ASC
    `);
    const a = executeQuery("SELECT id, ragione_sociale FROM companies ORDER BY ragione_sociale ASC");
    const r = executeQuery("SELECT * FROM risks_master ORDER BY categoria, nome");
    const e = executeQuery("SELECT * FROM exams_master ORDER BY nome");

    setProtocolli(p.map(item => ({
      ...item,
      risks: JSON.parse(item.risks || '[]'),
      esami: JSON.parse(item.esami || '[]')
    })));
    setAziende(a);
    setRischiMaster(r);
    setExamsMaster(e);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddExam = (examName: string) => {
    if (!examName) return;
    if (formData.esami.find(e => e.nome === examName)) return;
    setFormData({
      ...formData,
      esami: [...formData.esami, { nome: examName, periodicita: formData.periodicita_mesi, obbligatorio: true }]
    });
  };

  const removeExam = (index: number) => {
    const newExams = [...formData.esami];
    newExams.splice(index, 1);
    setFormData({ ...formData, esami: newExams });
  };

  const updateExam = (index: number, field: keyof Exam, value: any) => {
    const newExams = [...formData.esami];
    newExams[index] = { ...newExams[index], [field]: value };
    setFormData({ ...formData, esami: newExams });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await runCommand(
        `UPDATE protocols SET
          company_id = ?, mansione = ?, homogeneous_group = ?,
          risks = ?, esami = ?, periodicita_mesi = ?, is_customizable = ?
        WHERE id = ?`,
        [
          formData.company_id, formData.mansione, formData.homogeneous_group,
          JSON.stringify(formData.risks), JSON.stringify(formData.esami),
          formData.periodicita_mesi, formData.is_customizable, editingId
        ]
      );
    } else {
      await runCommand(
        `INSERT INTO protocols (company_id, mansione, homogeneous_group, risks, esami, periodicita_mesi, is_customizable)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          formData.company_id, formData.mansione, formData.homogeneous_group,
          JSON.stringify(formData.risks), JSON.stringify(formData.esami),
          formData.periodicita_mesi, formData.is_customizable
        ]
      );
    }

    setShowForm(false);
    setEditingId(null);
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      company_id: '',
      mansione: '',
      homogeneous_group: '',
      risks: [],
      esami: [],
      periodicita_mesi: 12,
      is_customizable: 1
    });
  };

  const handleClone = (p: any) => {
    setFormData({
      ...p,
      company_id: '',
      mansione: `${p.mansione} (Copia)`
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (p: any) => {
    setFormData({
      company_id: p.company_id.toString(),
      mansione: p.mansione,
      homogeneous_group: p.homogeneous_group || '',
      risks: p.risks,
      esami: p.esami,
      periodicita_mesi: p.periodicita_mesi,
      is_customizable: p.is_customizable
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Sei sicuro di voler eliminare questa mansione?")) {
      await runCommand("DELETE FROM protocols WHERE id = ?", [id]);
      fetchData();
    }
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

    doc.save(`Protocollo_${p.azienda}_${p.mansione}.pdf`);
  };

  const filtered = protocolli.filter(p =>
    p.mansione.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.azienda.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight">Mansioni e Protocolli</h1>
          <p className="text-gray-500 font-medium mt-1">Gestione catalogo sicurezza e sorveglianza</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm(); }}
          className="btn-teal flex items-center gap-3"
        >
          <Plus size={20} strokeWidth={3} /> Nuova Mansione
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-10 rounded-[40px] mb-12 border-2 border-primary/5 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between mb-8">
             <h2 className="text-2xl font-black text-primary flex items-center gap-3">
               <Shield className="text-tealAction" /> {editingId ? 'Modifica Mansione' : 'Configura Nuova Mansione'}
             </h2>
             <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-accent font-black uppercase text-[10px] tracking-widest">Annulla</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Azienda Cliente</label>
                <select
                  required
                  className="input-standard"
                  value={formData.company_id}
                  onChange={e => setFormData({...formData, company_id: e.target.value})}
                >
                  <option value="">Seleziona Azienda...</option>
                  {aziende.map(a => <option key={a.id} value={a.id}>{a.ragione_sociale}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Mansione</label>
                <input
                  required
                  placeholder="es. Magazziniere carrellista"
                  className="input-standard"
                  value={formData.mansione}
                  onChange={e => setFormData({...formData, mansione: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Gruppo Omogeneo</label>
                <input
                  placeholder="es. Area Logistica"
                  className="input-standard"
                  value={formData.homogeneous_group}
                  onChange={e => setFormData({...formData, homogeneous_group: e.target.value})}
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
                    formData.risks.includes(r.nome) ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-gray-500 border-gray-100 hover:border-primary/20'
                  }`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={formData.risks.includes(r.nome)}
                      onChange={e => {
                        if (e.target.checked) setFormData({...formData, risks: [...formData.risks, r.nome]});
                        else setFormData({...formData, risks: formData.risks.filter(x => x !== r.nome)});
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
                    value={formData.periodicita_mesi}
                    onChange={e => setFormData({...formData, periodicita_mesi: parseInt(e.target.value)})}
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
                        {formData.esami.map((exam, idx) => (
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
                {editingId ? 'Aggiorna Mansione' : 'Salva Mansione'}
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
              placeholder="Cerca mansione o azienda..."
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
                <th>Mansione / Gruppo</th>
                <th>Azienda Cliente</th>
                <th>Rischi Associati</th>
                <th>Protocollo</th>
                <th className="text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="group">
                  <td className="px-8 py-6">
                    <div className="font-black text-primary text-base tracking-tight leading-tight">{p.mansione}</div>
                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">{p.homogeneous_group || 'Standard'}</div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="bg-tealAction/5 text-tealAction px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-tealAction/10">
                      {p.azienda}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-wrap gap-1">
                      {p.risks.slice(0, 2).map((r: string, i: number) => (
                        <span key={i} className="bg-primary/5 text-primary px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-primary/5">
                          {r}
                        </span>
                      ))}
                      {p.risks.length > 2 && <span className="text-[9px] text-gray-400 font-black">+{p.risks.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Accertamenti</span>
                          <span className="text-sm font-black text-primary">{p.esami.length} esami</span>
                       </div>
                       <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                          <ListChecks size={14} />
                       </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleEdit(p)} className="p-3 hover:bg-primary/5 text-gray-400 hover:text-primary rounded-2xl transition-all"><Edit2 size={18} /></button>
                      <button onClick={() => handleClone(p)} className="p-3 hover:bg-tealAction/5 text-gray-400 hover:text-tealAction rounded-2xl transition-all"><Copy size={18} /></button>
                      <button onClick={() => generateProtocolPDF(p)} className="p-3 hover:bg-primary/5 text-gray-400 hover:text-primary rounded-2xl transition-all"><Download size={18} /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-3 hover:bg-accent/10 text-accent rounded-2xl transition-all"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-24 text-center">
            <div className="bg-primary/5 w-20 h-20 rounded-[32px] flex items-center justify-center mx-auto mb-6">
               <ClipboardList size={40} className="text-primary/10" />
            </div>
            <p className="text-gray-400 font-black text-sm uppercase tracking-widest">Nessuna mansione configurata</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Protocolli;
