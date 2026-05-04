import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NuovaVisita from './NuovaVisita';
import * as db from '../lib/db';

// Mock the DB module
vi.mock('../lib/db', () => ({
  executeQuery: vi.fn(),
  runCommand: vi.fn(),
}));

// Mock jsPDF
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(function() {
    return {
      setFont: vi.fn(),
      text: vi.fn(),
      setFontSize: vi.fn(),
      setFillColor: vi.fn(),
      rect: vi.fn(),
      line: vi.fn(),
      save: vi.fn(),
      addPage: vi.fn(),
      getNumberOfPages: vi.fn().mockReturnValue(2),
      setPage: vi.fn(),
      splitTextToSize: vi.fn().mockReturnValue(['test']),
      addImage: vi.fn(),
    };
  }),
}));

// Mock pdfjs-dist and other heavy modules that might fail in jsdom
vi.mock('pdfjs-dist', () => ({
  default: {
    getDocument: vi.fn(),
  }
}));

vi.mock('../lib/gmail', () => ({
  fetchGmailMessages: vi.fn(),
  initGapiClient: vi.fn(),
  analyzeEmailWithAI: vi.fn(),
}));

vi.mock('../lib/attachments', () => ({
  fetchGmailAttachments: vi.fn(),
}));

describe('NuovaVisita Integration', () => {
  const mockWorker = {
    id: 1,
    nome: 'Mario',
    cognome: 'Rossi',
    mansione: 'Operaio',
    email: 'mario.rossi@example.com',
    codice_fiscale: 'RSSMRA80A01H501U',
    azienda: 'Test Azienda',
    rischi: '[]'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for fetchWorkers
    vi.mocked(db.executeQuery).mockImplementation((sql: string) => {
      if (sql.includes('FROM workers')) {
        return [mockWorker];
      }
      if (sql.includes('FROM doctor_profile')) {
        return [{ nome: 'Dott. Test', specializzazione: 'Medicina del Lavoro', n_iscrizione: '12345' }];
      }
      if (sql.includes('FROM companies')) {
          return [{ ragione_sociale: 'Test Azienda', sede_legale: 'Via Test 1' }];
      }
      if (sql.includes('SELECT id FROM visits')) {
        return [{ id: 101 }]; // Return a mock visit ID
      }
      return [];
    });
  });

  it('should complete the visit flow and save data', async () => {
    render(<NuovaVisita />);

    // Step 1: Select Worker
    expect(db.executeQuery).toHaveBeenCalled();

    const searchInput = screen.getByPlaceholderText(/Cerca lavoratore/i);
    fireEvent.change(searchInput, { target: { value: 'Rossi' } });

    const workerButton = await screen.findByRole('button', { name: /Rossi Mario/i });
    fireEvent.click(workerButton);

    const iniziaBtn = screen.getByRole('button', { name: /Inizia/i });
    fireEvent.click(iniziaBtn);

    // Step 2: Anamnesi
    // Check that structured sections are present
    expect(screen.getByText(/Anamnesi Familiare/i)).toBeInTheDocument();
    expect(screen.getByText(/Anamnesi Fisiologica/i)).toBeInTheDocument();

    const prossimoBtn1 = screen.getByRole('button', { name: /Prossimo Step/i });
    fireEvent.click(prossimoBtn1);

    // Step 3: Parametri e Esame Obiettivo
    expect(screen.getByText(/Parametri e Esame Obiettivo/i)).toBeInTheDocument();

    const spinbuttons = screen.getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[3], { target: { value: '80' } }); // Peso

    const vaiGiudizioBtn = screen.getByRole('button', { name: /Vai al Giudizio/i });
    fireEvent.click(vaiGiudizioBtn);

    // Step 4: Giudizio
    expect(screen.getByText(/Giudizio Finale/i)).toBeInTheDocument();

    const salvaBtn = screen.getByRole('button', { name: /Salva e Stampa/i });

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    fireEvent.click(salvaBtn);

    await waitFor(() => {
      expect(db.runCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO visits'),
        expect.anything()
      );
    });

    await waitFor(() => {
      expect(db.runCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO biometrics'),
        expect.anything()
      );
    });

    expect(alertMock).toHaveBeenCalledWith('Visita salvata con successo!');
  });
});
