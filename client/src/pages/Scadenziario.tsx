import { useState, useEffect } from 'react';
import { executeQuery, runCommand } from '../lib/db';
import {
  Calendar as CalendarIcon, Clock, Bell, Mail,
  FileSpreadsheet, Search, Filter,
  ChevronRight, AlertCircle, CheckCircle2,
  CalendarDays, List, Send, Check, X, Edit, MessageSquare
} from 'lucide-react';
import { isAfter, isBefore, addDays, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { appointmentService } from '../lib/appointmentService';
import { sendProposalEmail, sendRescheduleEmail } from '../lib/emailService';
import type { Appointment } from '../types';

const Scadenziario = () => {
  const [visite, setVisite] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [aziende, setAziende] = useState<any[]>([]);
  const [filter, setFilter] = useState('all'); // all, expired, upcoming
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAzienda, setSelectedAzienda] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [notifications, setNotifications] = useState<{ appointmentId: number, workerName: string, body: string }[]>([]);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedVisita, setSelectedVisita] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [proposalData, setProposalData] = useState({ data: '', sede: '', note: '' });

  const loadData = async () => {
    const data = executeQuery(`
      SELECT visits.id, visits.worker_id, visits.data_visita, visits.scadenza_prossima, visits.giudizio, visits.tipo_visita,
             workers.nome, workers.cognome, workers.codice_fiscale, workers.email, companies.id as company_id, companies.ragione_sociale as azienda, workers.mansione
      FROM visits
      JOIN workers ON visits.worker_id = workers.id
      JOIN companies ON workers.company_id = companies.id
      ORDER BY visits.scadenza_prossima ASC
    `);
    setVisite(data);

    const apps = await appointmentService.getAll();
    setAppointments(apps);

    const aziendeData = executeQuery("SELECT DISTINCT ragione_sociale FROM companies ORDER BY ragione_sociale ASC");
    setAziende(aziendeData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = new Date();
  const next30Days = addDays(today, 30);
  const next7Days = addDays(today, 7);

  const filtered = visite.filter(v => {
    const expiry = new Date(v.scadenza_prossima);
    const matchesSearch = `${v.nome} ${v.cognome} ${v.azienda}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAzienda = selectedAzienda === '' || v.azienda === selectedAzienda;
    const matchesTipo = selectedTipo === '' || v.tipo_visita === selectedTipo;

    let matchesFilter = true;
    if (filter === 'expired') matchesFilter = isBefore(expiry, today);
    if (filter === 'upcoming') matchesFilter = isAfter(expiry, today) && isBefore(expiry, next30Days);

    return matchesSearch && matchesFilter && matchesAzienda && matchesTipo;
  });

  const exportCSV = async () => {
    const headers = ["Lavoratore", "Mansione", "Azienda", "Ultima Visita", "Prossima Scadenza", "Tipo Visita", "Stato"];
    const rows = filtered.map(v => {
      const expiry = new Date(v.scadenza_prossima);
      const isExpired = isBefore(expiry, today);
      const isUpcoming = isAfter(expiry, today) && isBefore(expiry, next30Days);
      const stato = isExpired ? 'Scaduta' : isUpcoming ? 'Imminente' : 'Regolare';

      return [
        `"${v.cognome} ${v.nome}"`,
        `"${v.mansione || ''}"`,
        `"${v.azienda}"`,
        `"${v.data_visita}"`,
        `"${v.scadenza_prossima}"`,
        `"${v.tipo_visita || ''}"`,
        `"${stato}"`
      ];
    });

    const csvContent = "\ufeff" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Scadenziario_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    await runCommand("INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
      ["EXPORT", "visits", 0, "Scadenziario esportato in CSV"]);
  };

  const export3B = async () => {
    // Basic CSV export for Allegato 3B
    const headers = ["Azienda", "Lavoratore", "CF Lavoratore", "Data Visita", "Giudizio"];
    const rows = filtered.map(v => [
      `"${v.azienda}"`,
      `"${v.cognome} ${v.nome}"`,
      `"${v.codice_fiscale}"`,
      `"${v.data_visita}"`,
      `"${v.giudizio || ''}"`
    ]);
    const csvContent = "\ufeff" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Allegato_3B_${new Date().getFullYear()}.csv`;
    link.click();

    await runCommand("INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
      ["EXPORT", "visits", 0, "Allegato 3B esportato"]);
  };

  const tipiVisita = [
    'Preventiva',
    'Periodica',
    'Su richiesta',
    'Cambio mansione',
    'Rientro da malattia',
    'Fine rapporto'
  ];

  const handleGmailSync = async () => {
    setLoadingGmail(true);
    try {
      // Request token
      const tokenResponse = await new Promise<any>((resolve) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: 'TUO_CLIENT_ID.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
          callback: resolve,
        });
        client.requestAccessToken();
      });

      if (tokenResponse.access_token) {
        sessionStorage.setItem('gmail_token', tokenResponse.access_token);
        const syncResults = await appointmentService.syncFromGmail(tokenResponse.access_token);
        setNotifications(syncResults);
        if (syncResults.length === 0) {
          alert("Nessuna nuova risposta trovata.");
        }
      }
    } catch (error) {
      console.error("Gmail sync error:", error);
      alert("Errore durante la sincronizzazione Gmail.");
    } finally {
      setLoadingGmail(false);
    }
  };

  const handleProposeDate = async () => {
    if (!selectedVisita) return;

    try {
      const token = sessionStorage.getItem('gmail_token');
      if (!token) {
         alert("Sincronizza prima Gmail per autorizzare l'invio.");
         return;
      }

      await appointmentService.create({
        worker_id: selectedVisita.worker_id,
        company_id: selectedVisita.company_id,
        data_proposta: proposalData.data,
        sede: proposalData.sede,
        stato: 'pending',
        notes: proposalData.note
      });

      await sendProposalEmail(
        token,
        selectedVisita.email,
        selectedVisita.nome,
        selectedVisita.azienda,
        proposalData.data,
        proposalData.sede,
        "Dott. Medicina del Lavoro"
      );

      setShowProposalModal(false);
      loadData();
    } catch (error) {
      console.error(error);
      alert("Errore nell'invio della proposta.");
    }
  };

  const handleConfirmResponse = async (notif: any) => {
    await appointmentService.updateStatus(notif.appointmentId, 'confirmed');
    setNotifications(notifications.filter(n => n.appointmentId !== notif.appointmentId));
    loadData();
    alert("Appuntamento confermato.");
  };

  const handleRescheduleSubmit = async () => {
    if (!selectedAppointment) return;

    try {
      const token = sessionStorage.getItem('gmail_token');
      await appointmentService.reschedule(selectedAppointment.id, proposalData.data, proposalData.note);

      if (token && confirm("Vuoi notificare il lavoratore della modifica?")) {
        const worker = executeQuery("SELECT email, nome FROM workers WHERE id = ?", [selectedAppointment.worker_id])[0];
        if (worker && worker.email) {
          await sendRescheduleEmail(
            token,
            worker.email,
            worker.nome,
            selectedAppointment.azienda_ragione_sociale || '',
            proposalData.data,
            selectedAppointment.sede,
            "Dott. Medicina del Lavoro"
          );
        }
      }

      setShowRescheduleModal(false);
      loadData();
    } catch (error) {
      console.error(error);
      alert("Errore durante la riprogrammazione.");
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight">Scadenziario Visite</h1>
          <p className="text-gray-500 font-medium mt-2">Pianificazione e gestione sorveglianza sanitaria</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-white rounded-2xl p-1 border border-gray-200 shadow-sm">
             <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-400 hover:text-primary'}`}
             >
               <List size={20} />
             </button>
             <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-primary text-white' : 'text-gray-400 hover:text-primary'}`}
             >
               <CalendarDays size={20} />
             </button>
          </div>
          <button
            onClick={handleGmailSync}
            className={`btn-teal flex items-center gap-3 ${loadingGmail ? 'animate-pulse opacity-70' : ''}`}
          >
            <Mail size={20} /> {loadingGmail ? 'Sincronizzazione...' : 'Sincronizza Gmail'}
          </button>
          <button
            onClick={exportCSV}
            className="btn-teal flex items-center gap-3 bg-warmWhite text-primary border border-gray-200 shadow-sm"
          >
            <FileSpreadsheet size={20} strokeWidth={3} /> Esporta CSV
          </button>
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

      {notifications.length > 0 && (
        <div className="mb-8 space-y-4">
          {notifications.map((notif, idx) => (
            <div key={idx} className="bg-white p-6 rounded-3xl border-2 border-accent shadow-xl flex items-center justify-between animate-in slide-in-from-top-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                   <MessageSquare size={24} />
                </div>
                <div>
                   <p className="font-black text-primary">Il lavoratore {notif.workerName} ha risposto alla proposta</p>
                   <p className="text-sm text-gray-500 italic mt-1">"{notif.body.substring(0, 100)}..."</p>
                </div>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => handleConfirmResponse(notif)} className="p-3 bg-tealAction text-white rounded-xl hover:scale-105 transition-all flex items-center gap-2 font-bold text-xs uppercase"><Check size={16} /> Conferma</button>
                 <button onClick={() => { setSelectedAppointment(appointments.find(a => a.id === notif.appointmentId) || null); setShowRescheduleModal(true); }} className="p-3 bg-primary text-white rounded-xl hover:scale-105 transition-all flex items-center gap-2 font-bold text-xs uppercase"><Edit size={16} /> Modifica</button>
                 <button onClick={async () => { await appointmentService.cancel(notif.appointmentId); setNotifications(notifications.filter(n => n.appointmentId !== notif.appointmentId)); loadData(); }} className="p-3 bg-red-600 text-white rounded-xl hover:scale-105 transition-all flex items-center gap-2 font-bold text-xs uppercase"><X size={16} /> Annulla</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' ? (
      <div className="glass-card rounded-[40px] overflow-hidden p-2">
        <div className="p-8 flex flex-wrap items-center justify-between gap-6 bg-warmWhite/20 border-b border-gray-100/50">
          <div className="flex-1 flex items-center gap-4 min-w-[300px]">
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

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-100">
               <Filter size={14} className="text-gray-400" />
               <select
                 className="bg-transparent text-[10px] font-black text-gray-500 uppercase tracking-widest outline-none"
                 value={selectedAzienda}
                 onChange={e => setSelectedAzienda(e.target.value)}
               >
                 <option value="">Tutte le Aziende</option>
                 {aziende.map(a => <option key={a.ragione_sociale} value={a.ragione_sociale}>{a.ragione_sociale}</option>)}
               </select>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-100">
               <Filter size={14} className="text-gray-400" />
               <select
                 className="bg-transparent text-[10px] font-black text-gray-500 uppercase tracking-widest outline-none"
                 value={selectedTipo}
                 onChange={e => setSelectedTipo(e.target.value)}
               >
                 <option value="">Tutti i Tipi Visita</option>
                 {tipiVisita.map(t => <option key={t} value={t}>{t}</option>)}
               </select>
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
                const isVeryUpcoming = isAfter(expiry, today) && isBefore(expiry, next7Days);
                const isUpcoming = isAfter(expiry, today) && isBefore(expiry, next30Days);
                const app = appointments.find(a => a.worker_id === v.worker_id && (a.stato !== 'cancelled'));

                return (
                  <tr key={v.id} className={`group ${isVeryUpcoming ? 'bg-red-50/30' : ''}`}>
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
                       <div className={`font-black text-sm flex items-center gap-2 ${isExpired ? 'text-red-600' : isVeryUpcoming ? 'text-red-500 animate-pulse' : isUpcoming ? 'text-accent' : 'text-primary'}`}>
                          <CalendarIcon size={14} /> {v.scadenza_prossima}
                       </div>
                    </td>
                    <td>
                      {app ? (
                        <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 w-fit border shadow-sm ${
                          app.stato === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                          app.stato === 'confirmed' ? 'bg-green-50 text-green-600 border-green-100' :
                          app.stato === 'rescheduled' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-gray-50 text-gray-400 border-gray-100'
                        }`}>
                          <CalendarIcon size={12} strokeWidth={3} /> {
                            app.stato === 'pending' ? 'In attesa' :
                            app.stato === 'confirmed' ? 'Confermata' :
                            app.stato === 'rescheduled' ? 'Riprogrammata' :
                            'Annullata'
                          }
                        </div>
                      ) : isExpired ? (
                        <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 w-fit border border-red-100 shadow-sm shadow-red-100/50">
                          <AlertCircle size={12} strokeWidth={3} /> Scaduta
                        </div>
                      ) : isVeryUpcoming ? (
                        <div className="bg-red-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 w-fit border border-red-700 shadow-sm shadow-red-200">
                          <AlertCircle size={12} strokeWidth={3} /> Critica (-7gg)
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
                        {app ? (
                           <button onClick={() => { setSelectedAppointment(app); setShowRescheduleModal(true); }} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-lg shadow-amber-100" title="Modifica Appuntamento">
                              <Edit size={18} />
                           </button>
                        ) : (
                          <button onClick={() => { setSelectedVisita(v); setProposalData({ data: v.scadenza_prossima, sede: 'Sede Aziendale', note: '' }); setShowProposalModal(true); }} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/5" title="Proponi Data">
                            <Send size={18} />
                          </button>
                        )}
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
      ) : (
        <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-xl overflow-hidden">
           <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black text-primary capitalize flex items-center gap-3">
                 <CalendarDays className="text-tealAction" /> {format(currentMonth, 'MMMM yyyy', { locale: it })}
              </h2>
              <div className="flex gap-2">
                 <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 bg-warmWhite rounded-xl hover:bg-gray-100"><ChevronRight className="rotate-180" size={20} /></button>
                 <button onClick={() => setCurrentMonth(new Date())} className="px-6 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Oggi</button>
                 <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 bg-warmWhite rounded-xl hover:bg-gray-100"><ChevronRight size={20} /></button>
              </div>
           </div>

           <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-3xl overflow-hidden">
              {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
                <div key={d} className="bg-warmWhite/50 p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">{d}</div>
              ))}
              {eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).map((day, i) => {
                const dayVisits = appointments.filter(a => isSameDay(new Date(a.data_proposta), day));
                return (
                  <div key={i} className="bg-white min-h-[140px] p-4 group hover:bg-primary/5 transition-colors">
                    <span className={`text-sm font-black ${isSameDay(day, new Date()) ? 'text-tealAction' : 'text-gray-300'}`}>{format(day, 'd')}</span>
                    <div className="mt-3 space-y-1">
                       {dayVisits.map((app, idx) => (
                         <div
                          key={idx}
                          onClick={() => { setSelectedAppointment(app); setShowRescheduleModal(true); }}
                          className={`p-2 rounded-lg text-[9px] font-black uppercase cursor-pointer border shadow-sm truncate ${
                            app.stato === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                            app.stato === 'confirmed' ? 'bg-green-50 text-green-600 border-green-100' :
                            app.stato === 'rescheduled' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-gray-50 text-gray-400 border-gray-100'
                          }`}
                          title={`${app.worker_cognome} - ${app.azienda_ragione_sociale}`}
                         >
                           {app.worker_cognome}
                         </div>
                       ))}
                    </div>
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* Modal Proposta Data */}
      {showProposalModal && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-white">
            <h3 className="text-xl font-black text-primary mb-6">Proponi Data Visita</h3>
            <div className="space-y-4 mb-8">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Proposta</label>
                <input
                  type="date"
                  className="input-standard"
                  value={proposalData.data}
                  onChange={e => setProposalData({...proposalData, data: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sede Visita</label>
                <input
                  className="input-standard"
                  value={proposalData.sede}
                  onChange={e => setProposalData({...proposalData, sede: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Note (Opzionale)</label>
                <textarea
                  className="input-standard min-h-[80px]"
                  value={proposalData.note}
                  onChange={e => setProposalData({...proposalData, note: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowProposalModal(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-gray-400">Annulla</button>
              <button onClick={handleProposeDate} className="flex-[2] btn-teal py-3 shadow-xl">Invia Proposta Email</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Riprogrammazione/Dettaglio */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-white">
            <h3 className="text-xl font-black text-primary mb-2">Gestione Appuntamento</h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-6">
              {selectedAppointment?.worker_cognome} {selectedAppointment?.worker_nome}
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nuova Data</label>
                <input
                  type="date"
                  className="input-standard"
                  value={proposalData.data}
                  onChange={e => setProposalData({...proposalData, data: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo Modifica</label>
                <textarea
                  className="input-standard min-h-[80px]"
                  placeholder="Es. Richiesta lavoratore..."
                  value={proposalData.note}
                  onChange={e => setProposalData({...proposalData, note: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3">
              <button onClick={handleRescheduleSubmit} className="w-full btn-teal py-4 shadow-xl flex items-center justify-center gap-2">
                 <CalendarIcon size={18} /> Salva Nuova Data
              </button>
              <div className="flex gap-3">
                 <button onClick={() => setShowRescheduleModal(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-gray-400">Annulla</button>
                 <button
                  onClick={async () => { if(selectedAppointment && confirm("Annullare la visita?")) { await appointmentService.cancel(selectedAppointment.id); setShowRescheduleModal(false); loadData(); } }}
                  className="flex-1 py-3 text-[10px] font-black uppercase text-red-600 border border-red-100 rounded-xl hover:bg-red-50"
                 >
                   Elimina
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
