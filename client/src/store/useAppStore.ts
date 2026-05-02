import { create } from 'zustand';

interface AppState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  currentTitle: string;
  setTitle: (title: string) => void;
  isEmailConfigured: boolean;
  senderEmail: string | null;
  setEmailConfig: (configured: boolean, email: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  currentTitle: 'Dashboard',
  setTitle: (title) => set({ currentTitle: title }),
  isEmailConfigured: false,
  senderEmail: null,
  setEmailConfig: (configured, email) => set({ isEmailConfigured: configured, senderEmail: email }),
}));
