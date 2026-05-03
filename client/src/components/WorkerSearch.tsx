import { useState, useEffect, useRef } from 'react';
import { Search, Building2, X } from 'lucide-react';
import { executeQuery } from '../lib/db';

interface Worker {
  id: number;
  nome: string;
  cognome: string;
  azienda: string;
  email: string;
  mansione: string;
}

interface WorkerSearchProps {
  onSelect: (workerId: string) => void;
  placeholder?: string;
  className?: string;
}

const WorkerSearch = ({ onSelect, placeholder = "Cerca lavoratore per nome, cognome o azienda...", className = "" }: WorkerSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Worker[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchResults = executeQuery<Worker>(`
      SELECT workers.id, workers.nome, workers.cognome, workers.mansione, workers.email, companies.ragione_sociale as azienda
      FROM workers
      JOIN companies ON workers.company_id = companies.id
      WHERE workers.nome LIKE ? OR workers.cognome LIKE ? OR companies.ragione_sociale LIKE ?
      LIMIT 10
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);

    setResults(searchResults);
    setIsOpen(true);
  }, [query]);

  const handleSelect = (worker: Worker) => {
    setSelectedWorker(worker);
    setQuery(`${worker.cognome} ${worker.nome}`);
    setIsOpen(false);
    onSelect(worker.id.toString());
  };

  const clearSelection = () => {
    setSelectedWorker(null);
    setQuery('');
    onSelect('');
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300">
          <Search size={20} />
        </div>
        <input
          type="text"
          className="w-full bg-white/50 border border-gray-100 rounded-[20px] py-4 pl-14 pr-12 text-lg font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-inner"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedWorker) setSelectedWorker(null);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
        />
        {query && (
          <button
            onClick={clearSelection}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-accent transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {results.map((worker) => (
            <button
              key={worker.id}
              onClick={() => handleSelect(worker)}
              className="w-full p-4 flex items-center gap-4 hover:bg-primary/5 transition-colors text-left border-b border-gray-50 last:border-0"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black shrink-0">
                {worker.cognome[0]}{worker.nome[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-primary truncate uppercase tracking-tight">
                  {worker.cognome} {worker.nome}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                  <Building2 size={12} />
                  <span className="truncate">{worker.azienda}</span>
                </div>
              </div>
              <div className="text-[10px] font-black text-tealAction bg-tealAction/5 px-2 py-1 rounded uppercase">
                {worker.mansione}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 text-center animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Nessun lavoratore trovato</p>
        </div>
      )}
    </div>
  );
};

export default WorkerSearch;
