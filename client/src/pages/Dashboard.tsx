import { useState, useEffect } from 'react';
import { executeQuery } from '../lib/db';
import { Building2, Users, Stethoscope, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState({
    aziende: 0,
    lavoratori: 0,
    visiteTotali: 0,
    scadenze: 0
  });

  useEffect(() => {
    const a = executeQuery("SELECT count(*) as count FROM companies")[0]?.count || 0;
    const l = executeQuery("SELECT count(*) as count FROM workers")[0]?.count || 0;
    const v = executeQuery("SELECT count(*) as count FROM visits")[0]?.count || 0;
    const s = executeQuery("SELECT count(*) as count FROM visits WHERE scadenza_prossima < date('now', '+30 days')")[0]?.count || 0;
    setStats({ aziende: a, lavoratori: l, visiteTotali: v, scadenze: s });
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500">Gestione Medicina del Lavoro - Allegato 3A</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard icon={<Building2 className="text-blue-600" />} label="Aziende Clienti" value={stats.aziende} color="bg-blue-50" />
        <StatCard icon={<Users className="text-purple-600" />} label="Lavoratori Attivi" value={stats.lavoratori} color="bg-purple-50" />
        <StatCard icon={<Stethoscope className="text-green-600" />} label="Visite Effettuate" value={stats.visiteTotali} color="bg-green-50" />
        <StatCard icon={<AlertTriangle className="text-orange-600" />} label="In Scadenza" value={stats.scadenze} color="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" /> Azioni Rapide
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickAction to="/nuova-visita" title="Esegui Visita" desc="Avvia protocollo Allegato 3A" />
            <QuickAction to="/aziende" title="Aggiungi Azienda" desc="Configura nuova anagrafica" />
            <QuickAction to="/lavoratori" title="Nuovo Lavoratore" desc="Associa a mansione/rischi" />
            <QuickAction to="/scadenziario" title="Controlla Scadenze" desc="Visualizza calendario" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">Benvenuto, Dottore</h2>
            <p className="text-blue-100 mb-6 max-w-xs">Tutti i dati sono salvati localmente in modo sicuro e conforme al GDPR.</p>
            <Link to="/settings" className="inline-flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition">
              Gestisci Profilo <ArrowRight size={18} />
            </Link>
          </div>
          <div className="absolute top-[-20px] right-[-20px] opacity-10">
            <Stethoscope size={200} />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: any, label: string, value: number, color: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
    <div className={`p-4 rounded-xl ${color}`}>{icon}</div>
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const QuickAction = ({ to, title, desc }: { to: string, title: string, desc: string }) => (
  <Link to={to} className="p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition text-left">
    <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
    <p className="text-xs text-gray-500">{desc}</p>
  </Link>
);

export default Dashboard;
