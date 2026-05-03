import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDB, executeQuery, runCommand, runCommands, getDB } from './db';
import * as auth from './auth';

// Mock sql.js
vi.mock('sql.js', () => {
  const mockDb = {
    exec: vi.fn().mockReturnValue([{ columns: ['id', 'name'], values: [[1, 'Test']] }]),
    run: vi.fn(),
    export: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  };
  return {
    default: vi.fn().mockResolvedValue({
      Database: vi.fn().mockImplementation(function() {
        return mockDb;
      }),
    }),
  };
});

// Mock auth
vi.mock('./auth', () => ({
  loadEncryptedDB: vi.fn().mockResolvedValue(null),
  saveEncryptedDB: vi.fn().mockResolvedValue(undefined),
}));

describe('db.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize the database', async () => {
    const db = await initDB();
    expect(db).toBeDefined();
    expect(auth.loadEncryptedDB).toHaveBeenCalled();
  });

  it('should execute query', async () => {
    // Ensure DB is initialized
    await initDB();
    const result = executeQuery('SELECT * FROM test');
    expect(result).toEqual([{ id: 1, name: 'Test' }]);
    expect(getDB()?.exec).toHaveBeenCalledWith('SELECT * FROM test', undefined);
  });

  it('should run command', async () => {
    await initDB();
    await runCommand('INSERT INTO test (name) VALUES (?)', ['New Name']);
    expect(getDB()?.run).toHaveBeenCalledWith('INSERT INTO test (name) VALUES (?)', ['New Name']);
    expect(auth.saveEncryptedDB).toHaveBeenCalled();
  });

  it('should run multiple commands', async () => {
    await initDB();
    const commands = [
      { sql: 'INSERT INTO test (name) VALUES (?)', params: ['Name 1'] },
      { sql: 'INSERT INTO test (name) VALUES (?)', params: ['Name 2'] }
    ];
    await runCommands(commands);
    // 16 initial risks + 8 initial exams + 21 migrations + 2 commands = 47
    // But initDB might be called multiple times or shared state
    expect(getDB()?.run).toHaveBeenCalledWith('INSERT INTO test (name) VALUES (?)', ['Name 1']);
    expect(getDB()?.run).toHaveBeenCalledWith('INSERT INTO test (name) VALUES (?)', ['Name 2']);
    expect(auth.saveEncryptedDB).toHaveBeenCalled();
  });
});
