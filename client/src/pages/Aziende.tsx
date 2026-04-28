import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { Plus, Search, Edit2, Trash2, Building2, MapPin } from 'lucide-react';

const Aziende = () => {
  const [aziende, setAziende] = useState<any[]>([]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCommand(
      `INSERT INTO companies (ragione_sociale, p_iva, ateco, sede_operativa, referente, rspp, rls)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [formData.ragione_sociale, formData.p_iva, formData.ateco, formData.sede_operativa, formData.referente, formData.rspp, formData.rls]
    );

    // Audit log for legal compliance
    await runCommand("INSERT INTO audit_logs (action, table_name, details) VALUES (?, ?, ?)",
      ["INSERT", "companies", `Nuova azienda: ${formData.ragione_sociale}`]);

    setShowForm(false);
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
                <tr key={azienda.id} className="group">
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
                      <button className="p-3 hover:bg-tealAction/10 text-tealAction rounded-2xl transition-all"><Edit2 size={18} /></button>
                      <button className="p-3 hover:bg-accent/10 text-accent rounded-2xl transition-all"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
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
