import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { initDB, runCommand } from './lib/db';
import { del } from 'idb-keyval';
import { checkSession, updateLastActivity } from './lib/auth';

// Pages
import Login from './pages/Login';
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
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(sessionStorage.getItem('isLoggedIn') === 'true');

  useEffect(() => {
    if (!isLoggedIn) return;

    let isMounted = true;
    const timeoutId = setTimeout(() => {
      if (isMounted && !dbReady && !error) {
        setError("Il caricamento del database cifrato sta impiegando troppo tempo. Verifica la password.");
      }
    }, 5000);

    initDB()
      .then(async () => {
        if (isMounted) {
          setDbReady(true);
          clearTimeout(timeoutId);
          // Log access
          await runCommand("INSERT INTO audit_logs (action, table_name, details) VALUES (?, ?, ?)",
            ["LOGIN", "system", `Accesso utente da ${navigator.userAgent}`]);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("App initialization error:", err);
          setError(`Errore critico nella decifrazione o inizializzazione: ${err.message}`);
          clearTimeout(timeoutId);
        }
      });

    const sessionInterval = setInterval(() => {
      if (!checkSession()) {
        setIsLoggedIn(false);
        setDbReady(false);
      }
    }, 30000); // Check every 30s

    const activityHandler = () => updateLastActivity();
    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('keydown', activityHandler);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      clearInterval(sessionInterval);
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
    };
  }, [isLoggedIn]);

  const handleReset = () => {
    if (confirm("Sei sicuro? Questo cancellerà tutti i dati locali e il database cifrato.")) {
      localStorage.clear();
      Promise.all([
        del('cartsan_db_v2'),
        del('cartsan_db_encrypted'),
        del('user_password_hash')
      ]).then(() => {
        window.location.reload();
      });
    }
  };


  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center font-sans bg-warmWhite p-6">
        <div className="glass-card p-10 rounded-[40px] max-w-md w-full border-red-600/20 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h2 className="text-2xl font-black text-primary mb-4 uppercase tracking-tight">Accesso Negato</h2>
          <p className="text-gray-500 font-bold text-sm mb-8 leading-relaxed">
            {error}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]"
            >
              Riprova Caricamento
            </button>
            <button
              onClick={handleReset}
              className="text-red-600/60 hover:text-red-600 font-black text-[10px] uppercase tracking-widest transition-colors py-2"
            >
              Ripristina Database (Cancella Dati)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center font-sans bg-warmWhite">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-1000">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-primary"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-accent rounded-full animate-ping"></div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-primary font-black uppercase tracking-[0.2em] text-xs">Sistema CartSan Lean</p>
            <p className="text-gray-400 font-bold text-[10px] mt-2">Inizializzazione Database Allegato 3A...</p>
          </div>
        </div>
      </div>
    );
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
