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
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">Protocolli Sanitari</h1>
          <p className="text-gray-500 font-medium">Definizione esami per mansione</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-teal flex items-center gap-2"
        >
          <Plus size={20} strokeWidth={3} /> Nuovo Protocollo
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-8 rounded-[32px] mb-10">
          <h2 className="text-xl font-black text-primary mb-6">Configura Protocollo</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Azienda</label>
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
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Mansione / Gruppo Omogeneo</label>
              <input
                required
                placeholder="es. Impiegato Video-terminalista"
                className="input-standard"
                value={formData.mansione}
                onChange={e => setFormData({...formData, mansione: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Esami Previsti (separati da virgola)</label>
              <textarea
                required
                placeholder="es. Visita Medica, Audiometria, Spirometria, Ergoftalmologia"
                className="input-standard h-24"
                value={formData.esami}
                onChange={e => setFormData({...formData, esami: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Periodicità (mesi)</label>
              <input
                type="number"
                className="input-standard font-black"
                value={formData.periodicita_mesi}
                onChange={e => setFormData({...formData, periodicita_mesi: parseInt(e.target.value)})}
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 text-gray-400 font-bold hover:text-primary transition">Annulla</button>
              <button type="submit" className="btn-teal px-10">Salva Protocollo</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {protocolli.map(p => (
          <div key={p.id} className="bg-white p-7 rounded-[32px] border border-white shadow-lg hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-black text-primary text-lg tracking-tight mb-1">{p.mansione}</h3>
                <div className="text-[10px] font-black text-tealAction flex items-center gap-1 uppercase tracking-widest bg-tealAction/5 px-2 py-1 rounded-full w-fit">
                  <Building2 size={10} /> {p.azienda}
                </div>
              </div>
              <button onClick={() => handleDelete(p.id)} className="p-2 text-gray-300 hover:text-accent transition-colors">
                <Trash2 size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Esami del Protocollo</div>
              <div className="flex flex-wrap gap-2">
                {p.esami.split(',').map((e: string, i: number) => (
                  <span key={i} className="bg-primary/5 text-primary px-3 py-1.5 rounded-xl text-xs font-bold border border-primary/5 group-hover:bg-primary/10 transition-colors">
                    {e.trim()}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-300 uppercase">Periodicità</span>
                <span className="text-lg font-black text-primary">{p.periodicita_mesi} mesi</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                <ClipboardList size={22} />
              </div>
            </div>
            {/* Visual accent */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 -mr-8 -mt-8 rounded-full blur-xl" />
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
