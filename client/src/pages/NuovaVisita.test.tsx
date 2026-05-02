import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NuovaVisita from './NuovaVisita';
import * as db from '../lib/db';
import { MemoryRouter } from 'react-router-dom';

// Mock DB module
vi.mock('../lib/db', () => ({
  executeQuery: vi.fn(),
  runCommand: vi.fn(),
}));

// Mock jsPDF
const mockJsPdfInstance = {
  text: vi.fn(),
  rect: vi.fn(),
  line: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  save: vi.fn(),
};

vi.mock('jspdf', () => {
  return {
    jsPDF: vi.fn().mockImplementation(function() {
      return mockJsPdfInstance;
    }),
  };
});

// Mock pdfjs-dist and related libs
vi.mock('pdfjs-dist', () => ({
  default: {},
}));

vi.mock('../lib/gmail', () => ({
  fetchGmailMessages: vi.fn(),
}));

vi.mock('../lib/attachments', () => ({
  fetchGmailAttachments: vi.fn(),
}));

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

// Mock WorkerSearch component
vi.mock('../components/WorkerSearch', () => ({
  default: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <div data-testid="worker-search">
      <button onClick={() => onSelect('1')}>Select Worker 1</button>
    </div>
  ),
}));

// Mock window.alert
window.alert = vi.fn();

describe('NuovaVisita Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock initial worker list
    (db.executeQuery as any).mockImplementation((sql: string) => {
      if (sql.includes('FROM workers')) {
        if (sql.includes('JOIN companies')) {
            return [
                { id: 1, nome: 'Mario', cognome: 'Rossi', mansione: 'Operaio', email: 'mario@example.com', codice_fiscale: 'RSSMRA80A01H501U', azienda: 'Test SRL' }
            ];
        }
        if (sql.includes('LEFT JOIN protocols')) {
            return [
                { id: 1, nome: 'Mario', cognome: 'Rossi', protocol_periodicity: 12 }
            ];
        }
      }
      if (sql.includes('FROM doctor_profile')) {
        return [{ id: 1, nome: 'Dr. Smith', specializzazione: 'Medicina del Lavoro', n_iscrizione: '12345' }];
      }
      if (sql.includes('SELECT id FROM visits')) {
        return [{ id: 101 }];
      }
      return [];
    });
  });

  it('should complete the visit flow and save data', async () => {
    render(
      <MemoryRouter>
        <NuovaVisita />
      </MemoryRouter>
    );

    // Step 1: Select Worker
    expect(screen.getByText('Esecuzione Visita Medica')).toBeInTheDocument();
    const selectButton = screen.getByText('Select Worker 1');
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText('Test SRL')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Inizia');
    fireEvent.click(startButton);

    // Step 2: Anamnesi
    await waitFor(() => {
      expect(screen.getByText('Anamnesi Lavorativa')).toBeInTheDocument();
    });

    const anamnesiLavorativaTextarea = screen.getAllByRole('textbox')[0];
    fireEvent.change(anamnesiLavorativaTextarea, { target: { value: 'Lavora in fabbrica da 10 anni' } });
    fireEvent.click(screen.getByText('Prossimo Step'));

    // Step 3: Biometrics & Esame Obiettivo
    await waitFor(() => {
      expect(screen.getByText('Parametri e Esame Obiettivo')).toBeInTheDocument();
    });

    const sistolicaInput = screen.getByDisplayValue('120');
    fireEvent.change(sistolicaInput, { target: { value: '130' } });

    fireEvent.click(screen.getByText('Vai al Giudizio'));

    // Step 4: Giudizio
    await waitFor(() => {
      expect(screen.getByText('Giudizio Finale')).toBeInTheDocument();
    });

    const giudizioSelect = screen.getByRole('combobox');
    fireEvent.change(giudizioSelect, { target: { value: 'idoneo' } });

    const saveButton = screen.getByText('Salva e Stampa');
    fireEvent.click(saveButton);

    // Verify DB calls
    await waitFor(() => {
      expect(db.runCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO visits'),
        expect.any(Array)
      );
      expect(db.runCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO biometrics'),
        expect.any(Array)
      );
    });

    expect(window.alert).toHaveBeenCalledWith("Visita salvata con successo!");
  });
});
