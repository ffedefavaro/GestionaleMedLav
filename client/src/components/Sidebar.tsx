import {
  LayoutDashboard,
  Building2,
  Users,
  Stethoscope,
  Calendar,
  Settings,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertOctagon
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const SidebarItem = ({ icon: Icon, label, to, active }: { icon: any, label: string, to: string, active: boolean }) => (
  <Link
    to={to}
    className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
      active
        ? 'bg-accent text-white shadow-lg shadow-accent/20'
        : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
    {label && <span className="font-medium text-sm">{label}</span>}
  </Link>
);

const Sidebar = () => {
  const { isSidebarOpen, toggleSidebar } = useAppStore();
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
    { icon: Building2, label: 'Aziende', to: '/aziende' },
    { icon: Users, label: 'Lavoratori', to: '/lavoratori' },
    { icon: Stethoscope, label: 'Nuova Visita', to: '/nuova-visita' },
    { icon: Calendar, label: 'Scadenziario', to: '/scadenziario' },
    { icon: ClipboardList, label: 'Protocolli', to: '/protocolli' },
    { icon: ShieldAlert, label: 'Sicurezza / RSPP', to: '/sicurezza' },
    { icon: AlertOctagon, label: 'Registro Esposti', to: '/registro-esposti' },
    { icon: Settings, label: 'Impostazioni', to: '/settings' },
  ];

  return (
    <div className={`h-screen bg-sidebar transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col text-white shadow-2xl z-50`}>
      <div className="p-6 flex items-center justify-between mb-4">
        {isSidebarOpen && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Stethoscope size={18} className="text-white" />
            </div>
            <h1 className="text-lg font-black tracking-tight uppercase">CartSan</h1>
          </div>
        )}
        <button onClick={toggleSidebar} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.to}
            icon={item.icon}
            label={isSidebarOpen ? item.label : ''}
            to={item.to}
            active={location.pathname === item.to}
          />
        ))}
      </nav>

      <div className="p-6 border-t border-white/5">
        {isSidebarOpen && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Powered by</p>
            <p className="text-xs font-medium text-gray-300 italic opacity-60 font-sans">Lean Medical Systems</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
