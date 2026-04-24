import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';

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
          <h1 className="text-3xl font-black text-primary tracking-tight">Gestione Aziende</h1>
          <p className="text-gray-500 font-medium">Anagrafica clienti e sedi operative</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-accent flex items-center gap-2"
        >
          <Plus size={20} strokeWidth={3} /> Nuova Azienda
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-8 rounded-[32px] mb-10">
          <h2 className="text-xl font-black text-primary mb-6">Configurazione Nuova Azienda</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2 col-span-full">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Ragione Sociale</label>
              <input
                required
                className="input-standard"
                value={formData.ragione_sociale}
                onChange={e => setFormData({...formData, ragione_sociale: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Partita IVA / CF</label>
              <input
                className="input-standard"
                value={formData.p_iva}
                onChange={e => setFormData({...formData, p_iva: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Codice ATECO</label>
              <input
                className="input-standard font-mono"
                value={formData.ateco}
                onChange={e => setFormData({...formData, ateco: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Sede Operativa</label>
              <input
                className="input-standard"
                value={formData.sede_operativa}
                onChange={e => setFormData({...formData, sede_operativa: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Referente</label>
              <input
                className="input-standard"
                value={formData.referente}
                onChange={e => setFormData({...formData, referente: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">RSPP</label>
              <input
                className="input-standard"
                value={formData.rspp}
                onChange={e => setFormData({...formData, rspp: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">RLS</label>
              <input
                className="input-standard"
                value={formData.rls}
                onChange={e => setFormData({...formData, rls: e.target.value})}
              />
            </div>
            <div className="col-span-full flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 text-gray-400 font-bold hover:text-primary transition"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="btn-accent px-10"
              >
                Salva Azienda
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card rounded-[32px] overflow-hidden p-2">
        <div className="p-6 flex items-center gap-4">
          <Search className="text-gray-400" size={24} />
          <input
            placeholder="Cerca per ragione sociale o P.IVA..."
            className="flex-1 bg-transparent outline-none text-primary font-bold placeholder:text-gray-300"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <table className="table-medical">
          <thead>
            <tr>
              <th>Ragione Sociale</th>
              <th>P.IVA / CF</th>
              <th>Sede</th>
              <th>Referente</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((azienda) => (
              <tr key={azienda.id}>
                <td className="font-black text-primary">{azienda.ragione_sociale}</td>
                <td className="font-mono text-xs text-gray-500 uppercase">{azienda.p_iva}</td>
                <td className="text-gray-500 font-medium">{azienda.sede_operativa}</td>
                <td className="text-gray-600 font-bold">{azienda.referente}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="p-2 hover:bg-white text-tealAction rounded-xl transition-colors"><Edit2 size={18} /></button>
                    <button className="p-2 hover:bg-accent/10 text-accent rounded-xl transition-colors"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-500">Nessuna azienda trovata.</div>
        )}
      </div>
    </div>
  );
};

export default Aziende;
