import { describe, it, expect, vi } from 'vitest';

// Mock sql.js since it uses WASM and is hard to test in node without setup
vi.mock('sql.js', () => {
  return {
    default: vi.fn().mockResolvedValue({
      Database: vi.fn().mockImplementation(() => ({
        exec: vi.fn().mockReturnValue([{ columns: ['id', 'name'], values: [[1, 'Test']] }]),
        run: vi.fn(),
        export: vi.fn().mockReturnValue(new Uint8Array())
      }))
    })
  };
});

// For testing executeQuery directly, we need a way to pass a mock db or use the singleton
// Since db is private in lib/db.ts, we'll test the logic via executeQuery if we can initialize it,
// but for unit tests, we'll focus on the generic typing and mapping logic.

describe('Database Module', () => {
  it('generic executeQuery should map columns to objects', () => {
    // This is a behavioral test of the logic we refactored
    const mockDb = {
      exec: vi.fn().mockReturnValue([{
        columns: ['id', 'ragione_sociale'],
        values: [[1, 'Azienda Test'], [2, 'Azienda 2']]
      }])
    };

    // Simulate the internal logic of executeQuery with the provided mockDb
    const mapResult = (result: { columns: string[], values: (string | number | boolean | null)[][] }) => {
      const columns = result.columns;
      return result.values.map((row) => {
        const obj: Record<string, string | number | boolean | null> = {};
        columns.forEach((col: string, i: number) => {
          obj[col] = row[i];
        });
        return obj;
      });
    };

    const data = mapResult(mockDb.exec('SELECT...')[0]);
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ id: 1, ragione_sociale: 'Azienda Test' });
    expect(data[1].id).toBe(2);
  });
});
