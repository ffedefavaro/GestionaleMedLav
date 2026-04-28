import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import {
  Calendar as CalendarIcon, Clock, Bell, Mail,
  FileSpreadsheet, Search, Filter,
  ChevronRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import { isAfter, isBefore, addDays } from 'date-fns';

const Scadenziario = () => {
  const [visite, setVisite] = useState<any[]>([]);
  const [filter, setFilter] = useState('all'); // all, expired, upcoming
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const data = executeQuery(`
      SELECT visits.id, visits.data_visita, visits.scadenza_prossima, visits.giudizio,
             workers.nome, workers.cognome, workers.codice_fiscale, companies.ragione_sociale as azienda, workers.mansione
      FROM visits
      JOIN workers ON visits.worker_id = workers.id
      JOIN companies ON workers.company_id = companies.id
      ORDER BY visits.scadenza_prossima ASC
    `);
    setVisite(data);
  }, []);

  const today = new Date();
  const next30Days = addDays(today, 30);

  const filtered = visite.filter(v => {
    const expiry = new Date(v.scadenza_prossima);
    const matchesSearch = `${v.nome} ${v.cognome} ${v.azienda}`.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    if (filter === 'expired') matchesFilter = isBefore(expiry, today);
    if (filter === 'upcoming') matchesFilter = isAfter(expiry, today) && isBefore(expiry, next30Days);

    return matchesSearch && matchesFilter;
  });

  const export3B = async () => {
    // Basic CSV export for Allegato 3B
    const headers = ["Azienda", "Lavoratore", "CF Lavoratore", "Data Visita", "Giudizio"];
    const rows = filtered.map(v => [v.azienda, `${v.cognome} ${v.nome}`, v.codice_fiscale, v.data_visita, v.giudizio]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Allegato_3B_${new Date().getFullYear()}.csv`;
    link.click();

    await runCommand("INSERT INTO audit_logs (action, details) VALUES (?, ?)",
      ["EXPORT", "Allegato 3B esportato"]);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight">Scadenziario Visite</h1>
          <p className="text-gray-500 font-medium mt-2">Pianificazione e gestione sorveglianza sanitaria</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={export3B}
            className="btn-teal flex items-center gap-3 bg-primary shadow-primary/20"
          >
            <FileSpreadsheet size={20} strokeWidth={3} /> Esporta Allegato 3B
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <StatusFilter
          label="Totale Visite"
          count={visite.length}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          icon={<CalendarIcon size={20} />}
          color="bg-primary"
        />
        <StatusFilter
          label="In Scadenza (30gg)"
          count={visite.filter(v => isAfter(new Date(v.scadenza_prossima), today) && isBefore(new Date(v.scadenza_prossima), next30Days)).length}
          active={filter === 'upcoming'}
          onClick={() => setFilter('upcoming')}
          icon={<Clock size={20} />}
          color="bg-accent"
        />
        <StatusFilter
          label="Scadute / Irregolari"
          count={visite.filter(v => isBefore(new Date(v.scadenza_prossima), today)).length}
          active={filter === 'expired'}
          onClick={() => setFilter('expired')}
          icon={<Bell size={20} />}
          color="bg-red-600"
        />
      </div>

      <div className="glass-card rounded-[40px] overflow-hidden p-2">
        <div className="p-8 flex flex-wrap items-center justify-between gap-8 bg-warmWhite/20 border-b border-gray-100/50">
          <div className="flex-1 flex items-center gap-4 max-w-xl">
            <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-100 flex items-center gap-3 flex-1">
              <Search className="text-gray-300" size={24} />
              <input
                placeholder="Cerca lavoratore o azienda..."
                className="flex-1 bg-transparent outline-none text-primary font-bold placeholder:text-gray-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Filter size={14} /> Filtro Avanzato
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-medical">
            <thead>
              <tr>
                <th>Lavoratore / Mansione</th>
                <th>Azienda Cliente</th>
                <th>Ultima Visita</th>
                <th>Prossima Scadenza</th>
                <th>Stato</th>
                <th className="text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const expiry = new Date(v.scadenza_prossima);
                const isExpired = isBefore(expiry, today);
                const isUpcoming = isAfter(expiry, today) && isBefore(expiry, next30Days);

                return (
                  <tr key={v.id} className="group">
                    <td>
                      <div className="font-black text-primary text-base tracking-tight leading-none mb-1">{v.cognome} {v.nome}</div>
                      <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{v.mansione}</div>
                    </td>
                    <td>
                       <span className="bg-tealAction/5 text-tealAction px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-tealAction/5">
                        {v.azienda}
                       </span>
                    </td>
                    <td className="text-gray-400 font-bold text-xs">{v.data_visita}</td>
                    <td>
                       <div className={`font-black text-sm flex items-center gap-2 ${isExpired ? 'text-red-600' : isUpcoming ? 'text-accent' : 'text-primary'}`}>
                          <CalendarIcon size={14} /> {v.scadenza_prossima}
                       </div>
                    </td>
                    <td>
                      {isExpired ? (
                        <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 w-fit border border-red-100 shadow-sm shadow-red-100/50">
                          <AlertCircle size={12} strokeWidth={3} /> Scaduta
                        </div>
                      ) : isUpcoming ? (
                        <div className="bg-accent/5 text-accent px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 w-fit border border-accent/10 shadow-sm shadow-accent/10">
                          <Clock size={12} strokeWidth={3} /> Imminente
                        </div>
                      ) : (
                        <div className="bg-tealAction/5 text-tealAction px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 w-fit border border-tealAction/10">
                          <CheckCircle2 size={12} strokeWidth={3} /> Regolare
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-center items-center gap-2">
                        <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/5" title="Invia Convocazione">
                          <Mail size={18} />
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-warmWhite/50 text-gray-300 hover:text-primary transition-all" title="Dettagli">
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-20 text-center">
             <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <CalendarIcon size={32} className="text-primary/10" />
            </div>
            <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Nessuna scadenza trovata</p>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusFilter = ({ label, count, active, onClick, icon, color }: { label: string, count: number, active: boolean, onClick: () => void, icon: any, color: string }) => (
  <button
    onClick={onClick}
    className={`p-6 rounded-[32px] border transition-all duration-300 text-left flex justify-between items-center group ${
      active
        ? `${color} text-white shadow-2xl border-transparent scale-[1.02]`
        : 'bg-white border-white shadow-lg hover:shadow-xl text-primary'
    }`}
  >
    <div>
      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${active ? 'text-white/60' : 'text-gray-400'}`}>
        {label}
      </p>
      <p className="text-3xl font-black tracking-tighter">{count}</p>
    </div>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
      active ? 'bg-white/20 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-primary/5 group-hover:text-primary'
    }`}>
      {icon}
    </div>
  </button>
);

export default Scadenziario;
