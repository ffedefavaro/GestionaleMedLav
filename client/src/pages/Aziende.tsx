import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { Plus, Building2, Search, Edit2, Trash2 } from 'lucide-react';

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
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="text-blue-600" /> Gestione Aziende
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Nuova Azienda
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Aggiungi Nuova Azienda</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1 col-span-full">
              <label className="text-sm font-medium text-gray-600">Ragione Sociale</label>
              <input
                required
                className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.ragione_sociale}
                onChange={e => setFormData({...formData, ragione_sociale: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Partita IVA / CF</label>
              <input
                className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.p_iva}
                onChange={e => setFormData({...formData, p_iva: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Codice ATECO</label>
              <input
                className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.ateco}
                onChange={e => setFormData({...formData, ateco: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Sede Operativa</label>
              <input
                className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.sede_operativa}
                onChange={e => setFormData({...formData, sede_operativa: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Referente Aziendale</label>
              <input
                className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.referente}
                onChange={e => setFormData({...formData, referente: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">RSPP</label>
              <input
                className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.rspp}
                onChange={e => setFormData({...formData, rspp: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">RLS</label>
              <input
                className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.rls}
                onChange={e => setFormData({...formData, rls: e.target.value})}
              />
            </div>
            <div className="col-span-full flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Salva Azienda
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
          <Search className="text-gray-400" size={20} />
          <input
            placeholder="Cerca per ragione sociale o P.IVA..."
            className="flex-1 outline-none text-gray-700"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ragione Sociale</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">P.IVA</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Sede</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Referente</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((azienda) => (
              <tr key={azienda.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-gray-800 font-medium">{azienda.ragione_sociale}</td>
                <td className="px-6 py-4 text-gray-600">{azienda.p_iva}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">{azienda.sede_operativa}</td>
                <td className="px-6 py-4 text-gray-600">{azienda.referente}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button className="p-1 hover:bg-blue-50 text-blue-600 rounded"><Edit2 size={18} /></button>
                    <button className="p-1 hover:bg-red-50 text-red-600 rounded"><Trash2 size={18} /></button>
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
