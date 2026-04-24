import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import { Calendar as CalendarIcon, Clock, Bell, Mail, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { isAfter, isBefore, addDays } from 'date-fns';

const Scadenziario = () => {
  const [visite, setVisite] = useState<any[]>([]);
  const [filter, setFilter] = useState('all'); // all, expired, upcoming

  useEffect(() => {
    const data = executeQuery(`
      SELECT visits.id, visits.data_visita, visits.scadenza_prossima, visits.giudizio,
             workers.nome, workers.cognome, companies.ragione_sociale as azienda, workers.mansione
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
    if (filter === 'expired') return isBefore(expiry, today);
    if (filter === 'upcoming') return isAfter(expiry, today) && isBefore(expiry, next30Days);
    return true;
  });

  const export3B = async () => {
    // Basic CSV export for Allegato 3B
    const headers = ["CF Lavoratore", "Data Visita", "Tipo Visita", "Giudizio"];
    const rows = filtered.map(v => [v.codice_fiscale, v.data_visita, v.tipo_visita, v.giudizio]);
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
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">Scadenziario Visite</h1>
          <p className="text-gray-500 font-medium">Pianificazione sorveglianza sanitaria</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={export3B}
            className="btn-teal flex items-center gap-2 bg-primary shadow-primary/20"
          >
            <FileSpreadsheet size={18} /> Allegato 3B
          </button>
          <div className="flex bg-white/50 backdrop-blur-sm border border-gray-100 rounded-2xl p-1.5 shadow-inner">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-primary'}`}
            >
              Tutte
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === 'upcoming' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-gray-400 hover:text-accent'}`}
            >
              In Scadenza
            </button>
            <button
              onClick={() => setFilter('expired')}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === 'expired' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-400 hover:text-red-600'}`}
            >
              Scadute
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[32px] overflow-hidden p-2">
        <table className="table-medical">
          <thead>
            <tr>
              <th>Lavoratore</th>
              <th>Azienda</th>
              <th>Ultima Visita</th>
              <th>Prossima Scadenza</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const expiry = new Date(v.scadenza_prossima);
              const isExpired = isBefore(expiry, today);
              const isUpcoming = isAfter(expiry, today) && isBefore(expiry, next30Days);

              return (
                <tr key={v.id}>
                  <td>
                    <div className="font-black text-primary">{v.cognome} {v.nome}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">{v.mansione}</div>
                  </td>
                  <td className="text-gray-500 font-bold">{v.azienda}</td>
                  <td className="text-gray-400 text-xs">{v.data_visita}</td>
                  <td className={`font-black ${isExpired ? 'text-red-600' : isUpcoming ? 'text-accent' : 'text-primary'}`}>
                    {v.scadenza_prossima}
                  </td>
                  <td>
                    {isExpired ? (
                      <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 w-fit border border-red-100">
                        <Bell size={10} strokeWidth={3} /> Scaduta
                      </span>
                    ) : isUpcoming ? (
                      <span className="bg-accent/5 text-accent px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 w-fit border border-accent/10">
                        <Clock size={10} strokeWidth={3} /> In Scadenza
                      </span>
                    ) : (
                      <span className="bg-tealAction/5 text-tealAction px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter w-fit border border-tealAction/10">
                        Regolare
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="p-2 hover:bg-white text-tealAction rounded-xl transition-colors" title="Invia Convocazione">
                        <Mail size={16} />
                      </button>
                      <button className="p-2 hover:bg-white text-primary rounded-xl transition-colors" title="Google Calendar">
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-20 text-center text-gray-500">
            <CalendarIcon className="mx-auto text-gray-200 mb-4" size={48} />
            Nessuna scadenza trovata per il filtro selezionato.
          </div>
        )}
      </div>
    </div>
  );
};

export default Scadenziario;
