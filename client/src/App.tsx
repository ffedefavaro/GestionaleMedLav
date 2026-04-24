import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { initDB } from './lib/db';

// Pages
import Aziende from './pages/Aziende';
import Lavoratori from './pages/Lavoratori';
import Protocolli from './pages/Protocolli';
import NuovaVisita from './pages/NuovaVisita';
import Scadenziario from './pages/Scadenziario';
import Sicurezza from './pages/Sicurezza';
import RegistroEsposti from './pages/RegistroEsposti';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';

function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDB().then(() => setDbReady(true));
  }, []);

  if (!dbReady) {
    return <div className="h-screen w-screen flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600">Inizializzazione Database Allegato 3A...</p>
      </div>
    </div>;
  }

  return (
    <Router>
      <div className="flex h-screen bg-warmWhite overflow-hidden font-sans text-anthracite">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-warmWhite relative">
          {/* Glassmorphism Background Accent */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-2xl -z-10" />

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/aziende" element={<Aziende />} />
            <Route path="/lavoratori" element={<Lavoratori />} />
            <Route path="/nuova-visita" element={<NuovaVisita />} />
            <Route path="/scadenziario" element={<Scadenziario />} />
            <Route path="/protocolli" element={<Protocolli />} />
            <Route path="/sicurezza" element={<Sicurezza />} />
            <Route path="/registro-esposti" element={<RegistroEsposti />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
