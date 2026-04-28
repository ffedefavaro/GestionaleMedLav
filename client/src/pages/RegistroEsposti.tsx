import { useState, useEffect } from 'react';
import { executeQuery } from '../lib/db';
import { Search, Download, AlertCircle, FileText, Filter } from 'lucide-react';

const RegistroEsposti = () => {
  const [esposti, setEsposti] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const data = executeQuery(`
      SELECT workers.cognome, workers.nome, workers.codice_fiscale, workers.mansione, workers.rischi, companies.ragione_sociale as azienda
      FROM workers
      JOIN companies ON workers.company_id = companies.id
      WHERE workers.rischi IS NOT NULL AND workers.rischi != '[]'
      ORDER BY azienda ASC, cognome ASC
    `);
    setEsposti(data);
  }, []);

  const filtered = esposti.filter(e =>
    `${e.nome} ${e.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.rischi.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.azienda.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight">Registro Esposti</h1>
          <p className="text-gray-500 font-medium mt-2">Monitoraggio agenti cancerogeni, mutageni e biologici (Titolo IX)</p>
        </div>
        <button
          onClick={exportCSV}
          className="btn-accent bg-primary hover:bg-sidebar flex items-center gap-3 shadow-primary/20"
        >
          <Download size={20} strokeWidth={3} /> Esporta Registro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-primary/5 p-6 rounded-[32px] border border-primary/5">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Totale Esposti</p>
           <p className="text-3xl font-black text-primary tracking-tighter">{esposti.length}</p>
        </div>
        <div className="bg-tealAction/5 p-6 rounded-[32px] border border-tealAction/5">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Aziende con Esposti</p>
           <p className="text-3xl font-black text-tealAction tracking-tighter">{new Set(esposti.map(e => e.azienda)).size}</p>
        </div>
        <div className="bg-accent/5 p-6 rounded-[32px] border border-accent/5">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Livello di Rischio</p>
           <p className="text-3xl font-black text-accent tracking-tighter">ALTO</p>
        </div>
      </div>

      <div className="glass-card rounded-[40px] overflow-hidden p-2">
        <div className="p-8 flex flex-wrap items-center justify-between gap-6 bg-warmWhite/20 border-b border-gray-100/50">
          <div className="flex-1 flex items-center gap-4 max-w-md">
            <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-100 flex items-center gap-3 flex-1">
              <Search className="text-gray-300" size={24} />
              <input
                placeholder="Cerca lavoratore o rischio..."
                className="flex-1 bg-transparent outline-none text-primary font-bold placeholder:text-gray-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Filter size={14} /> Filtro Rapido
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-medical">
            <thead>
              <tr>
                <th>Nominativo Lavoratore</th>
                <th>Azienda Cliente</th>
                <th>Fattori di Rischio Espositivi (DVR)</th>
                <th className="text-right">Dettagli</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, idx) => (
                <tr key={idx} className="group">
                  <td>
                    <div className="font-black text-primary text-base tracking-tight leading-none mb-1">{e.cognome} {e.nome}</div>
                    <div className="font-mono text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{e.codice_fiscale}</div>
                  </td>
                  <td>
                    <span className="bg-primary/5 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/5">
                      {e.azienda}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {JSON.parse(e.rischi).map((r: string, i: number) => (
                        <span key={i} className="bg-red-50 text-red-600 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter border border-red-100 flex items-center gap-1.5">
                          <AlertCircle size={10} /> {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-right">
                    <button className="p-3 bg-warmWhite/50 rounded-2xl text-gray-300 hover:text-primary transition-all">
                      <FileText size={20} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-20 text-center">
                    <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Search size={32} className="text-primary/10" />
                    </div>
                    <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Nessun esposto trovato per la ricerca</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RegistroEsposti;
