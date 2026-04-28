import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { initDB, runCommand } from './lib/db';
import { del } from 'idb-keyval';
import { checkSession, updateLastActivity } from './lib/auth';
import { get, set } from 'idb-keyval';

const APP_VERSION = '1.0.2'; // Update to trigger safety backup

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
  const [showBackupAlert, setShowBackupAlert] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;

    const checkVersionAndBackup = async () => {
      const lastVersion = await get('last_app_version');
      if (lastVersion && lastVersion !== APP_VERSION) {
        setShowBackupAlert(true);
        // Trigger automatic export of encrypted data
        const encrypted = await get('cartsan_db_encrypted');
        if (encrypted) {
          const blob = new Blob([encrypted], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `SAFETY_BACKUP_AUTO_${new Date().toISOString().split('T')[0]}.txt`;
          a.click();
        }
      }
      await set('last_app_version', APP_VERSION);
    };
    checkVersionAndBackup();

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
    const confirmation = prompt("ATTENZIONE: Questa operazione cancellerà TUTTI i dati permanentemente. Digita 'CANCELLA' per confermare:");
    if (confirmation === 'CANCELLA') {
      localStorage.clear();
      Promise.all([
        del('cartsan_db_v2'),
        del('cartsan_db_encrypted'),
        del('user_password_hash'),
        del('last_app_version')
      ]).then(() => {
        window.location.reload();
      });
    } else if (confirmation !== null) {
      alert("Operazione annullata. La parola di conferma non è corretta.");
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

  const isProduction = window.location.hostname === 'gestionalemedlav.netlify.app';

  return (
    <Router>
      <div className="flex h-screen bg-warmWhite overflow-hidden font-sans text-anthracite">
        {!isProduction && (
          <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-[9px] font-black uppercase tracking-[0.2em] py-1 text-center z-[200]">
             Attenzione: Sei in un ambiente di sviluppo/test. I dati inseriti qui non sono visibili sul sito principale.
          </div>
        )}
        {showBackupAlert && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-500">
             <div className="bg-primary text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-xl">
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                </div>
                <div>
                   <p className="font-black text-xs uppercase tracking-widest">Aggiornamento Rilevato</p>
                   <p className="text-[10px] font-bold opacity-60">Backup di sicurezza scaricato automaticamente.</p>
                </div>
                <button onClick={() => setShowBackupAlert(false)} className="ml-4 p-2 hover:bg-white/10 rounded-xl transition-colors">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
             </div>
          </div>
        )}
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
