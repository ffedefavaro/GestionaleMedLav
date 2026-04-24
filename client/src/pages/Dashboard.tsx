import { useState, useEffect } from 'react';
import { executeQuery } from '../lib/db';
import { Building2, Users, Stethoscope, AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState({
    aziende: 0,
    lavoratori: 0,
    visiteOggi: 0,
    scadenze: 0
  });

  useEffect(() => {
    const a = executeQuery("SELECT count(*) as count FROM companies")[0]?.count || 0;
    const l = executeQuery("SELECT count(*) as count FROM workers")[0]?.count || 0;
    const v = executeQuery("SELECT count(*) as count FROM visits WHERE data_visita = date('now')")[0]?.count || 0;
    const s = executeQuery("SELECT count(*) as count FROM visits WHERE scadenza_prossima < date('now', '+30 days')")[0]?.count || 0;
    setStats({ aziende: a, lavoratori: l, visiteOggi: v, scadenze: s });
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
        <StatCard icon={<Building2 size={24} />} label="Aziende Clienti" value={stats.aziende} trend="+2 questo mese" />
        <StatCard icon={<Users size={24} />} label="Lavoratori Attivi" value={stats.lavoratori} />
        <StatCard icon={<Stethoscope size={24} />} label="Visite Oggi" value={stats.visiteOggi} highlight />
        <StatCard icon={<AlertTriangle size={24} />} label="Scadenze 30gg" value={stats.scadenze} warning />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl border border-white/50 shadow-xl shadow-primary/5">
            <h2 className="text-xl font-black text-primary mb-6 flex items-center gap-3">
              <CheckCircle2 size={24} className="text-tealAction" /> Azioni Rapide
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
