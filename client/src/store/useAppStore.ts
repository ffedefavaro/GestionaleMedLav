import { create } from 'zustand';

interface AppState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  currentTitle: string;
  setTitle: (title: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  currentTitle: 'Dashboard',
  setTitle: (title) => set({ currentTitle: title }),
}));
