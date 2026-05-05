import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { executeQuery, runCommand } from '../lib/db';
import { Plus, Search, Edit2, Trash2, Building2, MapPin, Users, Stethoscope, User } from 'lucide-react';

const Aziende = () => {
  const navigate = useNavigate();
  const [aziende, setAziende] = useState<any[]>([]);
  const [expandedAziendaId, setExpandedAziendaId] = useState<number | null>(null);
  const [companyWorkers, setCompanyWorkers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    ragione_sociale: '',
    p_iva: '',
    ateco: '',
    sede_operativa: '',
    referente: '',
    rspp: '',
    rls: ''
  });

  const fetchAziende = () => {
    const data = executeQuery("SELECT * FROM companies ORDER BY ragione_sociale ASC");
    setAziende(data);
  };

  useEffect(() => {
    fetchAziende();
  }, []);

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Sei sicuro di voler eliminare l'azienda ${name}? Questa azione eliminerà anche tutti i protocolli associati.`)) {
      await runCommand("DELETE FROM companies WHERE id = ?", [id]);
      await runCommand("INSERT INTO audit_logs (action, table_name, details) VALUES (?, ?, ?)",
        ["DELETE", "companies", `Eliminata azienda: ${name} (ID: ${id})`]);
      fetchAziende();
    }
  };

  const handleEdit = (azienda: any) => {
    setFormData({
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

  const toggleWorkers = (aziendaId: number) => {
    if (expandedAziendaId === aziendaId) {
      setExpandedAziendaId(null);
      setCompanyWorkers([]);
    } else {
      const workers = executeQuery(`
        SELECT workers.*, protocols.mansione as protocol_name
        FROM workers
        LEFT JOIN protocols ON workers.protocol_id = protocols.id
        WHERE workers.company_id = ?
        ORDER BY cognome ASC
      `, [aziendaId]);
      setCompanyWorkers(workers);
      setExpandedAziendaId(aziendaId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await runCommand(
        `UPDATE companies SET ragione_sociale = ?, p_iva = ?, ateco = ?, sede_operativa = ?, referente = ?, rspp = ?, rls = ? WHERE id = ?`,
        [formData.ragione_sociale, formData.p_iva, formData.ateco, formData.sede_operativa, formData.referente, formData.rspp, formData.rls, editingId]
      );
    } else {
      await runCommand(
        `INSERT INTO companies (ragione_sociale, p_iva, ateco, sede_operativa, referente, rspp, rls)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [formData.ragione_sociale, formData.p_iva, formData.ateco, formData.sede_operativa, formData.referente, formData.rspp, formData.rls]
      );
    }

    // Audit log for legal compliance
    await runCommand("INSERT INTO audit_logs (action, table_name, details) VALUES (?, ?, ?)",
      ["INSERT", "companies", `Nuova azienda: ${formData.ragione_sociale}`]);

    setShowForm(false);
    setEditingId(null);
    setFormData({ ragione_sociale: '', p_iva: '', ateco: '', sede_operativa: '', referente: '', rspp: '', rls: '' });
    fetchAziende();
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
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-accent flex items-center gap-3"
        >
          <Plus size={20} strokeWidth={3} /> Nuova Azienda
        </button>
      </div>

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
                  value={formData.ragione_sociale}
                  onChange={e => setFormData({...formData, ragione_sociale: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Partita IVA / CF</label>
                <input
                  className="input-standard"
                  value={formData.p_iva}
                  onChange={e => setFormData({...formData, p_iva: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Codice ATECO</label>
                <input
                  className="input-standard font-mono"
                  value={formData.ateco}
                  onChange={e => setFormData({...formData, ateco: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sede Operativa</label>
                <input
                  className="input-standard"
                  value={formData.sede_operativa}
                  onChange={e => setFormData({...formData, sede_operativa: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Referente Aziendale</label>
                <input
                  className="input-standard"
                  value={formData.referente}
                  onChange={e => setFormData({...formData, referente: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">RSPP Nominato</label>
                <input
                  className="input-standard"
                  value={formData.rspp}
                  onChange={e => setFormData({...formData, rspp: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">RLS</label>
                <input
                  className="input-standard"
                  value={formData.rls}
                  onChange={e => setFormData({...formData, rls: e.target.value})}
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
                  <tr className={`group ${expandedAziendaId === azienda.id ? 'bg-primary/5' : ''}`}>
                    <td className="font-black text-primary text-base tracking-tight">
                      <div className="flex items-center gap-3">
                        {azienda.ragione_sociale}
                      </div>
                    </td>
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
                          onClick={() => toggleWorkers(azienda.id)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${expandedAziendaId === azienda.id ? 'bg-primary text-white' : 'bg-primary/5 text-primary hover:bg-primary/10'}`}
                        >
                          <Users size={16} /> Lavoratori
                        </button>
                        <button
                          onClick={() => handleEdit(azienda)}
                          className="p-3 hover:bg-tealAction/10 text-tealAction rounded-2xl transition-all"
                          title="Modifica"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(azienda.id, azienda.ragione_sociale)}
                          className="p-3 hover:bg-accent/10 text-accent rounded-2xl transition-all"
                          title="Elimina"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedAziendaId === azienda.id && (
                    <tr className="bg-primary/[0.02] animate-in fade-in slide-in-from-top-2 duration-300">
                      <td colSpan={5} className="p-8">
                        <div className="bg-white rounded-[32px] border border-primary/10 shadow-xl overflow-hidden">
                          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                            <h4 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                              <Users size={18} className="text-primary" /> Lavoratori di {azienda.ragione_sociale}
                            </h4>
                            <span className="text-[10px] font-black text-gray-400 uppercase bg-white px-3 py-1 rounded-full border border-gray-100">
                              {companyWorkers.length} dipendenti
                            </span>
                          </div>
                          <table className="w-full text-left">
                            <thead className="bg-gray-50/30">
                              <tr>
                                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Nominativo</th>
                                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Mansione</th>
                                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Azioni Rapide</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {companyWorkers.map(worker => (
                                <tr key={worker.id} className="hover:bg-primary/[0.01] transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black text-[10px]">
                                        {worker.cognome?.[0] ?? ''}{worker.nome?.[0] ?? ''}
                                      </div>
                                      <div>
                                        <div className="font-black text-primary text-sm">{worker.cognome ?? ''} {worker.nome ?? ''}</div>
                                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">{worker.codice_fiscale}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-gray-600">{worker.protocol_name || '---'}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex justify-center gap-2">
                                      <button
                                        onClick={() => navigate('/nuova-visita', { state: { workerId: worker.id } })}
                                        className="flex items-center gap-2 px-4 py-2 bg-tealAction/10 text-tealAction rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-tealAction hover:text-white transition-all shadow-sm shadow-tealAction/5"
                                      >
                                        <Stethoscope size={14} /> Nuova Visita
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {companyWorkers.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="p-10 text-center">
                                    <div className="flex flex-col items-center gap-2 opacity-30">
                                      <User size={32} />
                                      <p className="text-[10px] font-black uppercase tracking-widest">Nessun lavoratore assegnato</p>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
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
    </div>
  );
};

export default Aziende;
