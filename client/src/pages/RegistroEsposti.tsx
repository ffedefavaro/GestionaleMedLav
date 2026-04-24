import { useState, useEffect } from 'react';
import { executeQuery } from '../lib/db';
import { Search, Download } from 'lucide-react';

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
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">Registro Esposti</h1>
          <p className="text-gray-500 font-medium">Monitoraggio agenti cancerogeni e biologici</p>
        </div>
        <button onClick={exportCSV} className="btn-accent bg-anthracite flex items-center gap-2">
          <Download size={18} strokeWidth={3} /> Esporta Registro
        </button>
      </div>

      <div className="glass-card rounded-[32px] overflow-hidden p-2">
        <div className="p-6 flex items-center gap-4">
          <Search className="text-gray-400" size={24} />
          <input
            placeholder="Filtra per nome o rischio specifico..."
            className="flex-1 bg-transparent outline-none text-primary font-bold placeholder:text-gray-300"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <table className="table-medical">
          <thead>
            <tr>
              <th>Lavoratore</th>
              <th>Azienda</th>
              <th>Fattori di Rischio</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, idx) => (
              <tr key={idx}>
                <td>
                  <div className="font-black text-primary">{e.cognome} {e.nome}</div>
                  <div className="font-mono text-[10px] text-gray-400">{e.codice_fiscale}</div>
                </td>
                <td className="text-gray-500 font-bold">{e.azienda}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(e.rischi).map((r: string, i: number) => (
                      <span key={i} className="bg-red-50 text-red-600 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-red-100">
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
