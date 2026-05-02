import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDB, executeQuery, runCommand } from './db';

// Mock sql.js
const mockDb = {
  exec: vi.fn(),
  run: vi.fn(),
  export: vi.fn(() => new Uint8Array([1, 2, 3])),
};

class MockDatabase {
  constructor(data?: Uint8Array) {
    return mockDb;
  }
}

vi.mock('sql.js', () => {
  return {
    default: vi.fn(() => Promise.resolve({
      Database: MockDatabase
    }))
  };
});

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

import { get, set } from 'idb-keyval';
import initSqlJs from 'sql.js';

describe('DB Module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Provide default return values for exec to avoid crashes during initDB
    mockDb.exec.mockReturnValue([{ columns: ['count'], values: [[0]] }]);
    (get as any).mockResolvedValue(null);
  });

  it('should initialize a new database if none exists in IndexedDB', async () => {
    const db = await initDB();
    expect(db).toBeDefined();
    expect(initSqlJs).toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith('cartsan_db_v2');
  });

  it('should execute a query and return formatted results', async () => {
    await initDB();
    mockDb.exec.mockReturnValue([
      {
        columns: ['id', 'nome'],
        values: [[1, 'Mario'], [2, 'Luigi']]
      }
    ]);

    const results = executeQuery('SELECT * FROM workers');

    expect(results).toEqual([
      { id: 1, nome: 'Mario' },
      { id: 2, nome: 'Luigi' }
    ]);
    expect(mockDb.exec).toHaveBeenCalledWith('SELECT * FROM workers', undefined);
  });

  it('should return an empty array if query returns no results', async () => {
    await initDB();
    mockDb.exec.mockReturnValue([]);

    const results = executeQuery('SELECT * FROM empty_table');

    expect(results).toEqual([]);
  });

  it('should run a command and save the database', async () => {
    await initDB();
    await runCommand('INSERT INTO companies (ragione_sociale) VALUES (?)', ['Test Corp']);

    expect(mockDb.run).toHaveBeenCalledWith('INSERT INTO companies (ragione_sociale) VALUES (?)', ['Test Corp']);
    expect(set).toHaveBeenCalledWith('cartsan_db_v2', expect.any(Uint8Array));
  });
});
