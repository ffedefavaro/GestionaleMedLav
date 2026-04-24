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
    className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
      active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
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
    { icon: ShieldAlert, label: 'Sicurezza/RSPP', to: '/sicurezza' },
    { icon: AlertOctagon, label: 'Registro Esposti', to: '/registro-esposti' },
    { icon: Settings, label: 'Impostazioni', to: '/settings' },
  ];

  return (
    <div className={`h-screen bg-white border-r border-gray-200 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
      <div className="p-6 flex items-center justify-between border-bottom">
        {isSidebarOpen && <h1 className="text-xl font-bold text-blue-700">CartSan Lean</h1>}
        <button onClick={toggleSidebar} className="p-1 rounded-md hover:bg-gray-100">
          {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
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

      <div className="p-4 border-t border-gray-100 text-xs text-gray-400">
        {isSidebarOpen && <p>© 2024 Medicina del Lavoro</p>}
      </div>
    </div>
  );
};

export default Sidebar;
