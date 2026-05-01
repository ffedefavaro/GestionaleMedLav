import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NuovaVisita from './NuovaVisita';
import { executeQuery, runCommand } from '../lib/db';
import { MemoryRouter } from 'react-router-dom';

// Mock the DB module
vi.mock('../lib/db', () => ({
  executeQuery: vi.fn(),
  runCommand: vi.fn(),
}));

// Mock pdfjs-dist and other heavy/problematic libs
vi.mock('pdfjs-dist', () => ({
  default: {
    getDocument: vi.fn(),
  },
  GlobalWorkerOptions: {
    workerSrc: '',
  },
}));

vi.mock('../lib/attachments', () => ({
  fetchGmailAttachments: vi.fn(),
}));

vi.mock('../lib/gmail', () => ({
  fetchGmailMessages: vi.fn(),
}));

// Mock WorkerSearch component to simplify selection
vi.mock('../components/WorkerSearch', () => ({
  default: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button onClick={() => onSelect('1')} data-testid="mock-worker-select">Select Worker 1</button>
  ),
}));

// Mock jsPDF
vi.mock('jspdf', () => {
  return {
    jsPDF: function() {
      return {
        setFont: vi.fn().mockReturnThis(),
        text: vi.fn().mockReturnThis(),
        setFontSize: vi.fn().mockReturnThis(),
        rect: vi.fn().mockReturnThis(),
        line: vi.fn().mockReturnThis(),
        save: vi.fn().mockReturnThis(),
      };
    }
  };
});

describe('NuovaVisita Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());

    // Mock worker and company data
    vi.mocked(executeQuery).mockImplementation((sql: string) => {
      if (sql.includes('SELECT workers.id')) {
        return [{ id: 1, nome: 'Mario', cognome: 'Rossi', mansione: 'Operaio', email: 'mario@example.com', codice_fiscale: 'MRORSS80A01H501Z', azienda: 'Test Co' }];
      }
      if (sql.includes('SELECT workers.*')) {
        return [{ id: 1, protocol_periodicity: 12 }];
      }
      if (sql.includes('SELECT * FROM doctor_profile')) {
        return [{ nome: 'Dott. Test', specializzazione: 'Medicina del Lavoro', n_iscrizione: '12345' }];
      }
      if (sql.includes('SELECT id FROM visits')) {
        return [{ id: 999 }];
      }
      return [];
    });
  });

  it('should complete the visit flow and save to DB', async () => {
    render(
      <MemoryRouter>
        <NuovaVisita />
      </MemoryRouter>
    );

    // STEP 1: Selection
    expect(screen.getByText(/Scegli il Lavoratore/i)).toBeInTheDocument();

    // Select worker (using mock)
    fireEvent.click(screen.getByTestId('mock-worker-select'));

    // Verify worker info displayed
    expect(await screen.findByText(/Test Co/i)).toBeInTheDocument();
    expect(screen.getByText(/Operaio/i)).toBeInTheDocument();

    // Start visit
    const startBtn = screen.getByRole('button', { name: /Inizia/i });
    fireEvent.click(startBtn);

    // STEP 2: Anamnesi
    expect(await screen.findByRole('heading', { name: /Anamnesi/i })).toBeInTheDocument();

    const anamnesiLav = screen.getByLabelText(/Anamnesi Lavorativa/i);
    fireEvent.change(anamnesiLav, { target: { value: 'Lavora in ufficio' } });

    fireEvent.click(screen.getByText(/Prossimo Step/i));

    // STEP 3: Obiettivo
    expect(await screen.findByText(/Parametri e Esame Obiettivo/i)).toBeInTheDocument();

    // Set some vital signs
    const sistolica = screen.getByLabelText(/Sistolica/i);
    fireEvent.change(sistolica, { target: { value: '130' } });

    fireEvent.click(screen.getByText(/Vai al Giudizio/i));

    // STEP 4: Giudizio
    expect(await screen.findByText(/Giudizio Finale/i)).toBeInTheDocument();

    const giudizio = screen.getByLabelText(/Giudizio di Idoneità/i);
    fireEvent.change(giudizio, { target: { value: 'idoneo' } });

    // Save and finalize
    fireEvent.click(screen.getByText(/Salva e Stampa/i));

    // Verify DB calls
    await waitFor(() => {
      expect(runCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO visits'),
        expect.arrayContaining(['1', 'idoneo'])
      );
      expect(runCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO biometrics'),
        expect.arrayContaining([130])
      );
    });

    // Verify success message (alert is mocked by jsdom usually or needs to be mocked)
    // Here we can just verify the flow resets or alert was called if we mock it
  });
});
