import React, { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { Plus, Users, Search, Edit2, Trash2, Filter, ClipboardList } from 'lucide-react';
import StoricoLavoratore from './StoricoLavoratore';

const Lavoratori = () => {
  const [lavoratori, setLavoratori] = useState<any[]>([]);
  const [selectedForHistory, setSelectedForHistory] = useState<number | null>(null);
  const [aziende, setAziende] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAzienda, setSelectedAzienda] = useState<string>('all');

  const [rischiMaster, setRischiMaster] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    company_id: '',
    nome: '',
    cognome: '',
    codice_fiscale: '',
    email: '',
    data_nascita: '',
    mansione: '',
    data_assunzione: '',
    rischi: [] as string[]
  });

  const fetchData = () => {
    const l = executeQuery(`
      SELECT workers.*, companies.ragione_sociale as azienda
      FROM workers
      JOIN companies ON workers.company_id = companies.id
      ORDER BY cognome ASC
    `);
    const a = executeQuery("SELECT id, ragione_sociale FROM companies ORDER BY ragione_sociale ASC");
    const r = executeQuery("SELECT * FROM risks_master ORDER BY categoria, nome");
    setLavoratori(l);
    setAziende(a);
    setRischiMaster(r);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCommand(
      `INSERT INTO workers (company_id, nome, cognome, codice_fiscale, email, data_nascita, mansione, data_assunzione, rischi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [formData.company_id, formData.nome, formData.cognome, formData.codice_fiscale, formData.email, formData.data_nascita, formData.mansione, formData.data_assunzione, JSON.stringify(formData.rischi)]
    );

    // Log action for legal audit
    await runCommand(
      "INSERT INTO audit_logs (action, table_name, details) VALUES (?, ?, ?)",
      ["INSERT", "workers", `Nuovo lavoratore: ${formData.cognome} ${formData.nome}`]
    );

    setShowForm(false);
    setFormData({ company_id: '', nome: '', cognome: '', codice_fiscale: '', email: '', data_nascita: '', mansione: '', data_assunzione: '', rischi: [] });
    fetchData();
  };

  const filtered = lavoratori.filter(l => {
    const matchesSearch = `${l.nome} ${l.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) || l.codice_fiscale.includes(searchTerm.toUpperCase());
    const matchesAzienda = selectedAzienda === 'all' || l.company_id.toString() === selectedAzienda;
    return matchesSearch && matchesAzienda;
  });

  if (selectedForHistory) {
    return <StoricoLavoratore workerId={selectedForHistory} onBack={() => setSelectedForHistory(null)} />;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="text-blue-600" /> Gestione Lavoratori
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Nuovo Lavoratore
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Aggiungi Nuovo Lavoratore</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Azienda</label>
              <select
                required
                className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.company_id}
                onChange={e => setFormData({...formData, company_id: e.target.value})}
              >
                <option value="">Seleziona Azienda...</option>
                {aziende.map(a => <option key={a.id} value={a.id}>{a.ragione_sociale}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Nome</label>
              <input required className="border border-gray-300 rounded-md p-2" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Cognome</label>
              <input required className="border border-gray-300 rounded-md p-2" value={formData.cognome} onChange={e => setFormData({...formData, cognome: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Codice Fiscale</label>
              <input className="border border-gray-300 rounded-md p-2" value={formData.codice_fiscale} onChange={e => setFormData({...formData, codice_fiscale: e.target.value.toUpperCase()})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Email</label>
              <input type="email" className="border border-gray-300 rounded-md p-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Data di Nascita</label>
              <input type="date" className="border border-gray-300 rounded-md p-2" value={formData.data_nascita} onChange={e => setFormData({...formData, data_nascita: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Mansione</label>
              <input className="border border-gray-300 rounded-md p-2" value={formData.mansione} onChange={e => setFormData({...formData, mansione: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Data Assunzione</label>
              <input type="date" className="border border-gray-300 rounded-md p-2" value={formData.data_assunzione} onChange={e => setFormData({...formData, data_assunzione: e.target.value})} />
            </div>

            <div className="col-span-full border-t pt-4 mt-2">
              <label className="text-sm font-bold text-gray-700 mb-2 block uppercase tracking-wide">Fattori di Rischio Espositivi (DVR)</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl">
                {rischiMaster.map(r => (
                  <label key={r.id} className="flex items-center gap-2 text-xs text-gray-600 hover:bg-white p-1 rounded transition cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={formData.rischi.includes(r.nome)}
                      onChange={e => {
                        if (e.target.checked) setFormData({...formData, rischi: [...formData.rischi, r.nome]});
                        else setFormData({...formData, rischi: formData.rischi.filter(x => x !== r.nome)});
                      }}
                    />
                    <span>{r.nome} <span className="text-[10px] text-gray-400">({r.categoria})</span></span>
                  </label>
                ))}
              </div>
            </div>

            <div className="col-span-full flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salva Lavoratore</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
          <div className="flex-1 flex items-center gap-3 min-w-[300px]">
            <Search className="text-gray-400" size={20} />
            <input
              placeholder="Cerca per nome, cognome o CF..."
              className="flex-1 outline-none text-gray-700"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
            <Filter size={18} className="text-gray-400" />
            <select
              className="outline-none text-sm text-gray-600 bg-transparent cursor-pointer"
              value={selectedAzienda}
              onChange={e => setSelectedAzienda(e.target.value)}
            >
              <option value="all">Tutte le aziende</option>
              {aziende.map(a => <option key={a.id} value={a.id}>{a.ragione_sociale}</option>)}
            </select>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Lavoratore</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Codice Fiscale</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Azienda</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Mansione</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-800">{l.cognome} {l.nome}</div>
                  <div className="text-xs text-gray-500">{l.email || 'Email non inserita'}</div>
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm font-mono">{l.codice_fiscale}</td>
                <td className="px-6 py-4 text-gray-600">{l.azienda}</td>
                <td className="px-6 py-4 text-gray-600">{l.mansione}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedForHistory(l.id)}
                      className="p-1 hover:bg-blue-50 text-blue-600 rounded" title="Visualizza Cartella"
                    >
                      <ClipboardList size={18} />
                    </button>
                    <button className="p-1 hover:bg-blue-50 text-blue-600 rounded"><Edit2 size={18} /></button>
                    <button className="p-1 hover:bg-red-50 text-red-600 rounded"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-500">Nessun lavoratore trovato.</div>
        )}
      </div>
    </div>
  );
};

export default Lavoratori;
