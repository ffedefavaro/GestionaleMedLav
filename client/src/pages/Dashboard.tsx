import { useState, useEffect } from 'react';
import { executeQuery } from '../lib/db';
import { Building2, Users, Stethoscope, AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState({
    aziende: 0,
    scadenzeImminenti: 0, // 7 days
    visiteOggi: 0,
    idoneitaScadenza: 0 // 30 days
  });

  useEffect(() => {
    const a = executeQuery("SELECT count(*) as count FROM companies")[0]?.count || 0;
    const v = executeQuery("SELECT count(*) as count FROM visits WHERE data_visita = date('now')")[0]?.count || 0;
    const imminenti = executeQuery("SELECT count(*) as count FROM visits WHERE scadenza_prossima BETWEEN date('now') AND date('now', '+7 days')")[0]?.count || 0;
    const scadenza30 = executeQuery("SELECT count(*) as count FROM visits WHERE scadenza_prossima BETWEEN date('now') AND date('now', '+30 days')")[0]?.count || 0;
    setStats({ aziende: a, scadenzeImminenti: imminenti, visiteOggi: v, idoneitaScadenza: scadenza30 });
  }, []);

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight">Benvenuto, Dottore</h1>
          <p className="text-gray-500 mt-2 font-medium">Panoramica operativa medicina del lavoro</p>
        </div>
        <div className="bg-accent/10 px-4 py-2 rounded-full flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-widest border border-accent/20">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          Sistema Online Local
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard icon={<Stethoscope size={24} />} label="Visite Oggi" value={stats.visiteOggi} highlight />
        <StatCard icon={<AlertTriangle size={24} />} label="Scadenze Imminenti" value={stats.scadenzeImminenti} warning />
        <StatCard icon={<Building2 size={24} />} label="Aziende Attive" value={stats.aziende} />
        <StatCard icon={<Users size={24} />} label="Idoneità in Scadenza" value={stats.idoneitaScadenza} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Agenda del Giorno / Visite Recenti */}
          <div className="bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-primary flex items-center gap-3">
                  <div className="p-2 bg-primary/5 rounded-xl text-primary"><Stethoscope size={24} /></div>
                  Agenda Odierna
                </h2>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/50 px-3 py-1 rounded-full border border-gray-100">
                  {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
             </div>

             <div className="space-y-4">
                {/* Mock data for visualization if none exists, or fetch real ones */}
                <div className="bg-white p-5 rounded-3xl border border-gray-50 flex items-center justify-between group hover:border-tealAction/20 transition-all">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-warmWhite rounded-2xl flex flex-col items-center justify-center text-primary border border-gray-100">
                         <span className="text-[9px] font-black uppercase leading-none">Ore</span>
                         <span className="text-lg font-black tracking-tighter">09:30</span>
                      </div>
                      <div>
                         <p className="font-black text-primary tracking-tight">Esempio: Mario Rossi</p>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Azienda Trasporti S.p.A. | Periodica</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                         <div className="h-full bg-tealAction w-3/4 rounded-full" />
                      </div>
                      <span className="text-[10px] font-black text-tealAction uppercase tracking-widest">In Corso</span>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-50 flex items-center justify-between opacity-60 group">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex flex-col items-center justify-center text-gray-400">
                         <span className="text-[9px] font-black uppercase leading-none">Ore</span>
                         <span className="text-lg font-black tracking-tighter">11:00</span>
                      </div>
                      <div>
                         <p className="font-black text-primary tracking-tight">Esempio: Laura Bianchi</p>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Edilizia Nord S.r.l. | Preventiva</p>
                      </div>
                   </div>
                   <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">In Attesa</span>
                </div>
             </div>

             <div className="mt-8 pt-6 border-t border-gray-100/50 flex justify-end">
                <Link to="/scadenziario" className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                  Vedi Scadenziario Completo <ArrowRight size={14} />
                </Link>
             </div>
          </div>

          <div className="bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl">
            <h2 className="text-2xl font-black text-primary mb-8 flex items-center gap-3">
              <div className="p-2 bg-tealAction/5 rounded-xl text-tealAction"><CheckCircle2 size={24} /></div>
              Azioni Rapide
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuickAction to="/nuova-visita" title="Esegui Nuova Visita" desc="Avvia protocollo Allegato 3A" accent="bg-tealAction" />
              <QuickAction to="/aziende" title="Configura Azienda" desc="Gestione anagrafiche e sedi" accent="bg-primary" />
              <QuickAction to="/lavoratori" title="Gestione Lavoratori" desc="Mansioni e fattori di rischio" accent="bg-primary" />
              <QuickAction to="/scadenziario" title="Calendario Scadenze" desc="Pianificazione sorveglianza" accent="bg-accent" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-sidebar p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden h-full flex flex-col justify-between">
            <div className="relative z-10">
              <h2 className="text-2xl font-black mb-4 leading-tight">Controllo Privacy <br/>& Sicurezza</h2>
              <p className="text-white/60 text-sm mb-8 leading-relaxed">
                Tutti i dati sensibili sono memorizzati esclusivamente in questo browser (IndexedDB).
              </p>
              <Link to="/settings" className="w-full justify-center inline-flex items-center gap-2 bg-accent text-white px-6 py-4 rounded-2xl font-black uppercase tracking-tighter hover:scale-[1.02] active:scale-[0.98] transition shadow-xl shadow-accent/20">
                Impostazioni <ArrowRight size={18} />
              </Link>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
              <ShieldAlert size={200} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, trend, highlight, warning }: { icon: any, label: string, value: number, trend?: string, highlight?: boolean, warning?: boolean }) => (
  <div className={`group bg-white p-7 rounded-[32px] border border-white shadow-lg shadow-primary/5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden ${highlight ? 'ring-2 ring-tealAction/20' : ''}`}>
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 ${warning ? 'bg-accent/10 text-accent' : highlight ? 'bg-tealAction/10 text-tealAction' : 'bg-primary/5 text-primary'}`}>
      {icon}
    </div>
    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
    <div className="flex items-baseline gap-2">
      <p className="text-4xl font-black text-primary tracking-tighter">{value}</p>
      {trend && <span className="text-[10px] font-bold text-tealAction">{trend}</span>}
    </div>
    {highlight && <div className="absolute top-4 right-4 w-2 h-2 bg-tealAction rounded-full animate-ping" />}
  </div>
);

const QuickAction = ({ to, title, desc, accent }: { to: string, title: string, desc: string, accent: string }) => (
  <Link to={to} className="group p-5 bg-white rounded-2xl border border-gray-100 hover:border-transparent hover:shadow-xl hover:shadow-primary/5 transition-all flex items-center gap-4">
    <div className={`w-2 h-10 rounded-full ${accent} opacity-20 group-hover:opacity-100 transition-opacity`} />
    <div>
      <h3 className="font-black text-primary text-sm tracking-tight">{title}</h3>
      <p className="text-xs text-gray-400 font-medium">{desc}</p>
    </div>
  </Link>
);

export default Dashboard;
