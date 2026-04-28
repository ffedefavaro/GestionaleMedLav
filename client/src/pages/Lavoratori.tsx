import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import {
  Plus, Search, Edit2, Trash2, Filter, ClipboardList,
  Shield, AlertCircle, CheckCircle2, ChevronRight, User,
  Briefcase, Info, History
} from 'lucide-react';
import StoricoLavoratore from './StoricoLavoratore';

const Lavoratori = () => {
  const [lavoratori, setLavoratori] = useState<any[]>([]);
  const [selectedForHistory, setSelectedForHistory] = useState<number | null>(null);
  const [aziende, setAziende] = useState<any[]>([]);
  const [protocolli, setProtocolli] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAzienda, setSelectedAzienda] = useState<string>('all');

  const [formData, setFormData] = useState({
    company_id: '',
    nome: '',
    cognome: '',
    codice_fiscale: '',
    email: '',
    data_nascita: '',
    data_assunzione: '',
    protocol_id: '',
    is_protocol_customized: 0,
    custom_protocol: [] as any[],
    protocol_override_reason: ''
  });

  const fetchData = () => {
    const l = executeQuery(`
      SELECT
        workers.*,
        companies.ragione_sociale as azienda,
        protocols.mansione as protocol_name
      FROM workers
      JOIN companies ON workers.company_id = companies.id
      LEFT JOIN protocols ON workers.protocol_id = protocols.id
      ORDER BY cognome ASC
    `);
    const a = executeQuery("SELECT id, ragione_sociale FROM companies ORDER BY ragione_sociale ASC");
    const p = executeQuery("SELECT * FROM protocols");

    setLavoratori(l.map(item => ({
      ...item,
      custom_protocol: JSON.parse(item.custom_protocol || '[]')
    })));
    setAziende(a);
    setProtocolli(p.map(item => ({
      ...item,
      esami: JSON.parse(item.esami || '[]')
    })));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProtocolChange = (protocolId: string) => {
    const selected = protocolli.find(p => p.id.toString() === protocolId);
    if (selected) {
      setFormData({
        ...formData,
        protocol_id: protocolId,
        is_protocol_customized: 0,
        custom_protocol: selected.esami,
        protocol_override_reason: ''
      });
    } else {
      setFormData({
        ...formData,
        protocol_id: '',
        is_protocol_customized: 0,
        custom_protocol: [],
        protocol_override_reason: ''
      });
    }
  };

  const toggleExamCustomization = (index: number, field: string, value: any) => {
    const newProtocol = [...formData.custom_protocol];
    newProtocol[index] = { ...newProtocol[index], [field]: value };
    setFormData({
      ...formData,
      custom_protocol: newProtocol,
      is_protocol_customized: 1
    });
  };

  const removeExamFromCustom = (index: number) => {
    const newProtocol = [...formData.custom_protocol];
    newProtocol.splice(index, 1);
    setFormData({
      ...formData,
      custom_protocol: newProtocol,
      is_protocol_customized: 1
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const params = [
      formData.company_id, formData.nome, formData.cognome, formData.codice_fiscale,
      formData.email, formData.data_nascita, formData.data_assunzione,
      formData.protocol_id, formData.is_protocol_customized,
      JSON.stringify(formData.custom_protocol), formData.protocol_override_reason
    ];

    if (editingId) {
      // Logic for history if protocol changed
      const old = lavoratori.find(l => l.id === editingId);
      if (old && (old.protocol_id?.toString() !== formData.protocol_id || old.is_protocol_customized !== formData.is_protocol_customized)) {
        await runCommand(
          "INSERT INTO worker_protocol_history (worker_id, old_protocol, new_protocol, reason) VALUES (?, ?, ?, ?)",
          [editingId, JSON.stringify(old.custom_protocol), JSON.stringify(formData.custom_protocol), formData.protocol_override_reason || 'Modifica anagrafica']
        );
      }

      await runCommand(
        `UPDATE workers SET
          company_id = ?, nome = ?, cognome = ?, codice_fiscale = ?,
          email = ?, data_nascita = ?, data_assunzione = ?,
          protocol_id = ?, is_protocol_customized = ?,
          custom_protocol = ?, protocol_override_reason = ?
        WHERE id = ?`,
        [...params, editingId]
      );
    } else {
      await runCommand(
        `INSERT INTO workers (
          company_id, nome, cognome, codice_fiscale, email, data_nascita,
          data_assunzione, protocol_id, is_protocol_customized,
          custom_protocol, protocol_override_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params
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
      nome: '',
      cognome: '',
      codice_fiscale: '',
      email: '',
      data_nascita: '',
      data_assunzione: '',
      protocol_id: '',
      is_protocol_customized: 0,
      custom_protocol: [],
      protocol_override_reason: ''
    });
  };

  const handleEdit = (l: any) => {
    setFormData({
      company_id: l.company_id.toString(),
      nome: l.nome,
      cognome: l.cognome,
      codice_fiscale: l.codice_fiscale,
      email: l.email || '',
      data_nascita: l.data_nascita || '',
      data_assunzione: l.data_assunzione || '',
      protocol_id: l.protocol_id ? l.protocol_id.toString() : '',
      is_protocol_customized: l.is_protocol_customized || 0,
      custom_protocol: l.custom_protocol || [],
      protocol_override_reason: l.protocol_override_reason || ''
    });
    setEditingId(l.id);
    setShowForm(true);
  };

  const filtered = lavoratori.filter(l => {
    const matchesSearch = `${l.nome} ${l.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) || (l.codice_fiscale && l.codice_fiscale.includes(searchTerm.toUpperCase()));
    const matchesAzienda = selectedAzienda === 'all' || l.company_id.toString() === selectedAzienda;
    return matchesSearch && matchesAzienda;
  });

  if (selectedForHistory) {
    return <StoricoLavoratore workerId={selectedForHistory} onBack={() => setSelectedForHistory(null)} />;
  }

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight">Anagrafica Lavoratori</h1>
          <p className="text-gray-500 font-medium">Gestione sorveglianza sanitaria individuale</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm(); }}
          className="btn-teal flex items-center gap-3"
        >
          <Plus size={20} strokeWidth={3} /> Nuovo Lavoratore
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-10 rounded-[40px] mb-12 border-2 border-primary/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-8">
             <h2 className="text-2xl font-black text-primary flex items-center gap-3">
               <User className="text-tealAction" /> {editingId ? 'Modifica Lavoratore' : 'Nuovo Lavoratore'}
             </h2>
             <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-accent font-black uppercase text-xs tracking-widest">Chiudi</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Dati Anagrafici */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Azienda</label>
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
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cognome</label>
                <input required className="input-standard font-black" value={formData.cognome} onChange={e => setFormData({...formData, cognome: e.target.value})} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome</label>
                <input required className="input-standard font-black" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Codice Fiscale</label>
                <input className="input-standard font-mono" value={formData.codice_fiscale} onChange={e => setFormData({...formData, codice_fiscale: e.target.value.toUpperCase()})} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                <input type="email" className="input-standard" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Assunzione</label>
                <input type="date" className="input-standard" value={formData.data_assunzione} onChange={e => setFormData({...formData, data_assunzione: e.target.value})} />
              </div>
            </div>

            {/* Protocollo Sanitario */}
            <div className="bg-warmWhite/30 p-8 rounded-[32px] border border-gray-100 space-y-8 shadow-inner">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-tealAction/10 flex items-center justify-center text-tealAction shadow-lg shadow-tealAction/5">
                       <Briefcase size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-primary leading-none">Mansione e Protocollo</h3>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Definisci il piano di sorveglianza</p>
                    </div>
                  </div>

                  <div className="flex-1 max-w-md ml-12">
                    <select
                      className="w-full bg-white border-2 border-gray-100 rounded-2xl p-4 text-sm font-black text-primary outline-none focus:border-tealAction shadow-sm transition-all"
                      value={formData.protocol_id}
                      onChange={e => handleProtocolChange(e.target.value)}
                    >
                      <option value="">-- Seleziona Mansione Aziendale --</option>
                      {protocolli.filter(p => p.company_id.toString() === formData.company_id).map(p => (
                        <option key={p.id} value={p.id}>{p.mansione}</option>
                      ))}
                    </select>
                  </div>
               </div>

               {formData.protocol_id && (
                 <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                       <div className="flex items-center gap-4">
                          <span className="text-xs font-black text-primary uppercase tracking-widest">Configurazione Protocollo</span>
                          {formData.is_protocol_customized ? (
                            <span className="bg-accent/10 text-accent px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-accent/20">
                               <AlertCircle size={12} strokeWidth={3} /> Personalizzato
                            </span>
                          ) : (
                            <span className="bg-tealAction/10 text-tealAction px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-tealAction/20">
                               <CheckCircle2 size={12} strokeWidth={3} /> Standard
                            </span>
                          )}
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-xl shadow-primary/5">
                          <table className="w-full text-left text-xs">
                             <thead className="bg-gray-50 border-b border-gray-100">
                               <tr>
                                 <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest">Esame</th>
                                 <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-widest">Periodicità</th>
                                 <th className="px-6 py-4"></th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-50">
                               {formData.custom_protocol.map((ex, idx) => (
                                 <tr key={idx} className="group hover:bg-primary/5 transition-colors">
                                   <td className="px-6 py-4 font-black text-primary text-sm">{ex.nome}</td>
                                   <td className="px-6 py-4">
                                      <div className="flex items-center gap-2 bg-warmWhite/50 px-3 py-2 rounded-xl border border-gray-50 group-hover:bg-white transition-colors">
                                        <input
                                          type="number"
                                          className="w-12 bg-transparent font-black text-primary outline-none"
                                          value={ex.periodicita}
                                          onChange={e => toggleExamCustomization(idx, 'periodicita', parseInt(e.target.value))}
                                        />
                                        <span className="text-gray-400 font-black uppercase text-[9px]">mesi</span>
                                      </div>
                                   </td>
                                   <td className="px-6 py-4 text-right">
                                      <button type="button" onClick={() => removeExamFromCustom(idx)} className="p-2 text-gray-300 hover:text-accent transition-colors">
                                        <Trash2 size={16} />
                                      </button>
                                   </td>
                                 </tr>
                               ))}
                             </tbody>
                          </table>
                       </div>

                       <div className="space-y-6">
                          <div className="flex flex-col gap-3">
                             <label className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2">
                               <Info size={14} /> Motivo della Personalizzazione (Obbligatorio)
                             </label>
                             <textarea
                               required={formData.is_protocol_customized === 1}
                               placeholder="Dettagliare la motivazione clinica per l'override del protocollo..."
                               className={`input-standard h-32 text-sm shadow-inner transition-all ${formData.is_protocol_customized ? 'border-accent/30 bg-accent/5 ring-4 ring-accent/5' : 'bg-white'}`}
                               value={formData.protocol_override_reason}
                               onChange={e => setFormData({...formData, protocol_override_reason: e.target.value})}
                             />
                          </div>
                          {editingId && (
                            <button type="button" className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 hover:bg-primary/5 p-3 rounded-xl transition-all w-fit">
                               <History size={16} /> Vedi Storico Protocolli Individuali
                            </button>
                          )}
                       </div>
                    </div>
                 </div>
               )}
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t border-gray-100">
              <button type="button" onClick={() => setShowForm(false)} className="px-8 py-3 text-gray-400 font-bold hover:text-primary transition">Annulla</button>
              <button type="submit" className="btn-teal px-16 py-4 shadow-2xl shadow-tealAction/20">
                {editingId ? 'Aggiorna Lavoratore' : 'Salva Lavoratore'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabella Lavoratori */}
      <div className="glass-card rounded-[40px] overflow-hidden p-2 shadow-2xl border border-white">
        <div className="p-8 flex flex-wrap items-center justify-between gap-8 bg-warmWhite/20 border-b border-gray-100/50">
          <div className="flex-1 flex items-center gap-4 max-w-xl">
            <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-100 flex items-center gap-4 flex-1">
              <Search className="text-gray-300" size={24} />
              <input
                placeholder="Cerca lavoratore o codice fiscale..."
                className="flex-1 outline-none text-primary font-black placeholder:text-gray-300 bg-transparent"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
              <Filter size={18} className="text-tealAction" />
              <select
                className="outline-none text-[10px] font-black text-primary uppercase tracking-widest bg-transparent cursor-pointer"
                value={selectedAzienda}
                onChange={e => setSelectedAzienda(e.target.value)}
              >
                <option value="all">Tutte le aziende</option>
                {aziende.map(a => <option key={a.id} value={a.id}>{a.ragione_sociale}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-medical">
            <thead>
              <tr>
                <th>Nominativo / Email</th>
                <th>Azienda Cliente</th>
                <th>Mansione / Protocollo</th>
                <th>Stato Sorveglianza</th>
                <th className="text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-xs shadow-inner">
                          {l.cognome[0]}{l.nome[0]}
                       </div>
                       <div>
                          <div className="font-black text-primary text-base tracking-tight leading-none mb-1">{l.cognome} {l.nome}</div>
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">{l.email || 'Nessun Recapito'}</div>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="bg-tealAction/5 text-tealAction px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-tealAction/10">
                      {l.azienda}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="font-black text-gray-600 text-sm">{l.protocol_name || <span className="text-gray-300 italic font-medium">Non Assegnato</span>}</div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{l.codice_fiscale}</div>
                  </td>
                  <td className="px-8 py-6">
                    {l.protocol_id ? (
                      <div className="flex items-center gap-2">
                        {l.is_protocol_customized ? (
                          <div className="flex items-center gap-1.5 text-accent bg-accent/5 px-3 py-1 rounded-lg border border-accent/10" title={l.protocol_override_reason}>
                            <Shield size={14} strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-tighter">Personalizzato</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-tealAction bg-tealAction/5 px-3 py-1 rounded-lg border border-tealAction/10">
                            <CheckCircle2 size={14} strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-tighter">Standard</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-gray-300 bg-gray-50 px-3 py-1 rounded-lg">
                        <AlertCircle size={14} />
                        <span className="text-[9px] font-black uppercase italic tracking-tighter">In attesa DVR</span>
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => setSelectedForHistory(l.id)}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/5"
                        title="Visualizza Cartella"
                      >
                        <ClipboardList size={20} />
                      </button>
                      <button
                        onClick={() => handleEdit(l)}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-warmWhite/50 text-gray-400 hover:bg-tealAction hover:text-white transition-all shadow-sm"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-accent/5 text-accent hover:bg-accent hover:text-white transition-all shadow-sm">
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight size={20} className="text-gray-200 group-hover:text-primary transition-colors ml-2" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-24 text-center">
            <div className="bg-primary/5 w-20 h-20 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner">
               <User size={40} className="text-primary/10" />
            </div>
            <p className="text-gray-400 font-black text-sm uppercase tracking-widest">Nessun lavoratore nel database</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lavoratori;
