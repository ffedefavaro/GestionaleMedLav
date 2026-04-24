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
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon className="text-blue-600" /> Scadenziario Visite
        </h1>
        <div className="flex gap-4">
          <button
            onClick={export3B}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm text-sm"
          >
            <FileSpreadsheet size={18} /> Esporta Allegato 3B
          </button>
          <div className="flex bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${filter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Tutte
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${filter === 'upcoming' ? 'bg-orange-50 text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              In Scadenza (30gg)
            </button>
            <button
              onClick={() => setFilter('expired')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${filter === 'expired' ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Scadute
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Lavoratore</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Azienda</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Ultima Visita</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Prossima Scadenza</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Stato</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((v) => {
              const expiry = new Date(v.scadenza_prossima);
              const isExpired = isBefore(expiry, today);
              const isUpcoming = isAfter(expiry, today) && isBefore(expiry, next30Days);

              return (
                <tr key={v.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{v.cognome} {v.nome}</div>
                    <div className="text-xs text-gray-500">{v.mansione}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{v.azienda}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{v.data_visita}</td>
                  <td className={`px-6 py-4 text-sm font-semibold ${isExpired ? 'text-red-600' : isUpcoming ? 'text-orange-600' : 'text-gray-700'}`}>
                    {v.scadenza_prossima}
                  </td>
                  <td className="px-6 py-4">
                    {isExpired ? (
                      <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                        <Bell size={12} /> SCADUTA
                      </span>
                    ) : isUpcoming ? (
                      <span className="bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                        <Clock size={12} /> IN SCADENZA
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-bold w-fit">
                        REGOLARE
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md" title="Invia Convocazione Mail">
                        <Mail size={18} />
                      </button>
                      <button className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md" title="Sincronizza Google Calendar">
                        <ExternalLink size={18} />
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
