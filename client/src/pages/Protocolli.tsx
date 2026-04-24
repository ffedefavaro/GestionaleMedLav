import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { ClipboardList, Plus, Building2, Trash2 } from 'lucide-react';

const Protocolli = () => {
  const [protocolli, setProtocolli] = useState<any[]>([]);
  const [aziende, setAziende] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    company_id: '',
    mansione: '',
    esami: '',
    periodicita_mesi: 12,
    rischi_associati: [] as string[]
  });

  const fetchData = () => {
    const p = executeQuery(`
      SELECT protocols.*, companies.ragione_sociale as azienda
      FROM protocols
      JOIN companies ON protocols.company_id = companies.id
    `);
    const a = executeQuery("SELECT id, ragione_sociale FROM companies ORDER BY ragione_sociale ASC");
    setProtocolli(p);
    setAziende(a);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCommand(
      "INSERT INTO protocols (company_id, mansione, esami, periodicita_mesi) VALUES (?, ?, ?, ?)",
      [formData.company_id, formData.mansione, formData.esami, formData.periodicita_mesi]
    );

    // Log for audit
    await runCommand("INSERT INTO audit_logs (action, table_name, details) VALUES (?, ?, ?)",
      ["INSERT", "protocols", `Nuovo protocollo per mansione: ${formData.mansione}`]);

    setShowForm(false);
    setFormData({ company_id: '', mansione: '', esami: '', periodicita_mesi: 12, rischi_associati: [] });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (confirm("Sei sicuro di voler eliminare questo protocollo?")) {
      await runCommand("DELETE FROM protocols WHERE id = ?", [id]);
      fetchData();
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ClipboardList className="text-blue-600" /> Protocolli Sanitari
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Nuovo Protocollo
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Configura Protocollo per Mansione</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Azienda</label>
              <select
                required
                className="border border-gray-300 rounded-md p-2"
                value={formData.company_id}
                onChange={e => setFormData({...formData, company_id: e.target.value})}
              >
                <option value="">Seleziona Azienda...</option>
                {aziende.map(a => <option key={a.id} value={a.id}>{a.ragione_sociale}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Mansione / Gruppo Omogeneo</label>
              <input
                required
                placeholder="es. Impiegato Video-terminalista"
                className="border border-gray-300 rounded-md p-2"
                value={formData.mansione}
                onChange={e => setFormData({...formData, mansione: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-sm font-medium text-gray-600">Esami Previsti (separati da virgola)</label>
              <textarea
                required
                placeholder="es. Visita Medica, Audiometria, Spirometria, Ergoftalmologia"
                className="border border-gray-300 rounded-md p-2 h-20"
                value={formData.esami}
                onChange={e => setFormData({...formData, esami: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Periodicità (mesi)</label>
              <input
                type="number"
                className="border border-gray-300 rounded-md p-2"
                value={formData.periodicita_mesi}
                onChange={e => setFormData({...formData, periodicita_mesi: parseInt(e.target.value)})}
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600">Annulla</button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg">Salva Protocollo</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {protocolli.map(p => (
          <div key={p.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-gray-800">{p.mansione}</h3>
                <div className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                  <Building2 size={12} /> {p.azienda}
                </div>
              </div>
              <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-600 transition">
                <Trash2 size={18} />
              </button>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Esami</div>
              <div className="flex flex-wrap gap-2">
                {p.esami.split(',').map((e: string, i: number) => (
                  <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                    {e.trim()}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm text-gray-500">Periodicità</span>
              <span className="text-sm font-semibold text-gray-700">{p.periodicita_mesi} mesi</span>
            </div>
          </div>
        ))}
      </div>

      {protocolli.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          Nessun protocollo sanitario configurato. Inizia definendo i rischi per mansione.
        </div>
      )}
    </div>
  );
};

export default Protocolli;
