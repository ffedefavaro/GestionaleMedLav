import React, { useState, useEffect } from 'react';
import { Shield, Lock, AlertCircle } from 'lucide-react';
import { get, set } from 'idb-keyval';
import { verifyPassword, setEncryptionKey, updateLastActivity, hashPassword } from '../lib/auth';

const Login = ({ onLogin }: { onLogin: () => void }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isFirstAccess, setIsFirstAccess] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      const storedHash = await get('user_password_hash');
      if (!storedHash) {
        setIsFirstAccess(true);
        setShowPrivacy(true);
      }
    };
    checkSetup();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }
    if (password !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }
    if (!privacyAccepted) {
      setError('Devi accettare l\'informativa privacy');
      return;
    }

    const hash = await hashPassword(password);
    await set('user_password_hash', hash);
    await set('privacy_accepted_at', new Date().toISOString());

    setEncryptionKey(password);
    updateLastActivity();
    sessionStorage.setItem('isLoggedIn', 'true');
    onLogin();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const storedHash = await get('user_password_hash');
    if (storedHash && await verifyPassword(password, storedHash)) {
      setEncryptionKey(password);
      updateLastActivity();
      sessionStorage.setItem('isLoggedIn', 'true');

      // Access log
      // Note: db might not be fully ready here if it's the very first load
      // but initDB will be called right after Login succeeds.
      // We'll handle logs inside the main App or after init.

      onLogin();
    } else {
      setError('Password errata');
    }
  };

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="bg-primary/20 w-20 h-20 rounded-[32px] flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-2xl">
            <Shield size={40} className="text-accent" />
          </div>
          <h1 className="text-white text-3xl font-black tracking-tighter uppercase">CartSan Lean</h1>
          <p className="text-white/40 font-bold uppercase text-[10px] tracking-widest mt-2">Sicurezza Dati Sanitari GDPR</p>
        </div>

        <div className="glass-card !bg-white/5 !backdrop-blur-2xl border border-white/10 p-10 rounded-[40px] shadow-2xl">
          <form onSubmit={isFirstAccess ? handleSetup : handleLogin} className="space-y-6">
            <div className="space-y-2 text-center mb-8">
              <h2 className="text-white text-xl font-bold">
                {isFirstAccess ? 'Configurazione Iniziale' : 'Accesso Protetto'}
              </h2>
              <p className="text-white/50 text-xs">
                {isFirstAccess ? 'Imposta una password master per cifrare il database' : 'Inserisci la password per sbloccare i dati'}
              </p>
            </div>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white font-bold outline-none focus:border-accent transition-all"
                placeholder="Master Password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
              />
            </div>

            {isFirstAccess && (
              <div className="relative animate-in slide-in-from-top-2">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white font-bold outline-none focus:border-accent transition-all"
                  placeholder="Conferma Password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold animate-pulse">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button type="submit" className="btn-accent w-full py-5 text-base shadow-2xl shadow-accent/20">
              {isFirstAccess ? 'Attiva Protezione Dati' : 'Sblocca Database'}
            </button>
          </form>
        </div>

        {showPrivacy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-sidebar/80 backdrop-blur-md">
            <div className="bg-white rounded-[40px] max-w-2xl w-full p-10 shadow-2xl overflow-hidden relative">
               <h2 className="text-2xl font-black text-primary mb-6 flex items-center gap-3">
                  <Shield size={28} className="text-accent" /> Informativa Privacy & GDPR
               </h2>
               <div className="max-h-96 overflow-y-auto pr-4 custom-scrollbar text-gray-600 text-sm space-y-4 font-medium leading-relaxed">
                  <p>In conformità al <strong>Regolamento UE 2016/679 (GDPR)</strong> e al <strong>D.Lgs. 196/2003</strong>, la informiamo che:</p>
                  <ul className="list-disc ml-6 space-y-2">
                    <li>I dati sanitari trattati in questa applicazione risiedono <strong>esclusivamente sul dispositivo locale</strong> dell'utente.</li>
                    <li>Nessun dato viene trasmesso a server esterni o terze parti senza esplicito comando (es. invio email).</li>
                    <li>L'applicazione utilizza una <strong>cifratura AES-256</strong> basata sulla password master da lei scelta.</li>
                    <li>In caso di smarrimento della password, i dati <strong>non saranno in alcun modo recuperabili</strong>, nemmeno dal produttore del software.</li>
                    <li>È responsabilità del Medico Competente garantire la custodia del dispositivo e della password in conformità alle misure minime di sicurezza.</li>
                  </ul>
                  <p className="pt-4 border-t border-gray-100">Proseguendo, lei accetta i termini di utilizzo e dichiara di aver compreso le modalità di trattamento dei dati sensibili.</p>
               </div>
               <div className="mt-10 flex items-center justify-between gap-6">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-6 h-6 rounded-lg border-2 border-gray-100 checked:bg-accent transition-all cursor-pointer"
                      checked={privacyAccepted}
                      onChange={e => setPrivacyAccepted(e.target.checked)}
                    />
                    <span className="text-[10px] font-black uppercase text-gray-400 group-hover:text-primary transition-colors">Accetto l'informativa privacy</span>
                  </label>
                  <button
                    disabled={!privacyAccepted}
                    onClick={() => setShowPrivacy(false)}
                    className="btn-accent px-10 py-4 disabled:opacity-30"
                  >
                    Continua
                  </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
