import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

export interface Worker {
  id: number;
  nome: string;
  cognome: string;
  azienda: string;
  email?: string;
  mansione?: string;
}

interface AppState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  currentTitle: string;
  setTitle: (title: string) => void;
  recentWorkers: Worker[];
  addRecentWorker: (worker: Worker) => void;
}

const storage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get(name);
    return value ? JSON.stringify(value) : null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, JSON.parse(value));
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      currentTitle: 'Dashboard',
      setTitle: (title) => set({ currentTitle: title }),
      recentWorkers: [],
      addRecentWorker: (worker) => set((state) => {
        const filtered = state.recentWorkers.filter((w) => w.id !== worker.id);
        return {
          recentWorkers: [worker, ...filtered].slice(0, 5)
        };
      }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ recentWorkers: state.recentWorkers }),
    }
  )
);
