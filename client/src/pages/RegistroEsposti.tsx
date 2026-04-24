import { useState, useEffect } from 'react';
import { executeQuery } from '../lib/db';
import { Shield, Search, Download } from 'lucide-react';

const RegistroEsposti = () => {
  const [esposti, setEsposti] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const data = executeQuery(`
      SELECT workers.cognome, workers.nome, workers.codice_fiscale, workers.mansione, workers.rischi, companies.ragione_sociale as azienda
      FROM workers
      JOIN companies ON workers.company_id = companies.id
      WHERE workers.rischi IS NOT NULL AND workers.rischi != '[]'
    `);
    setEsposti(data);
  }, []);

  const filtered = esposti.filter(e =>
    `${e.nome} ${e.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.rischi.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ["Azienda", "Lavoratore", "CF", "Mansione", "Rischi"];
    const rows = filtered.map(e => [e.azienda, `${e.cognome} ${e.nome}`, e.codice_fiscale, e.mansione, JSON.parse(e.rischi).join(";")]);
    const content = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Registro_Esposti_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="text-red-600" /> Registro Esposti (Cancerogeni/Biologici)
        </h1>
        <button onClick={exportCSV} className="bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
          <Download size={18} /> Esporta Registro
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
          <Search className="text-gray-400" size={20} />
          <input
            placeholder="Filtra per nome o rischio..."
            className="flex-1 outline-none text-gray-700"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">Lavoratore</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Azienda</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Fattori di Rischio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((e, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-bold">{e.cognome} {e.nome}</div>
                  <div className="text-xs text-gray-400">{e.codice_fiscale}</div>
                </td>
                <td className="px-6 py-4 text-gray-600">{e.azienda}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(e.rischi).map((r: string, i: number) => (
                      <span key={i} className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-100">
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegistroEsposti;
