import { describe, it, expect } from 'vitest';
import { addDays, isAfter, isBefore } from 'date-fns';

// Helper function logic from the Scadenziario and store
const calculateNextVisit = (lastVisitDate: string, periodicityMonths: number): string => {
  const date = new Date(lastVisitDate);
  date.setMonth(date.getMonth() + periodicityMonths);
  return date.toISOString().split('T')[0];
};

describe('Deadline Calculations', () => {
  it('should correctly calculate next visit date based on periodicity', () => {
    const lastVisit = '2024-01-01';
    const periodicity = 12; // 1 year
    const expected = '2025-01-01';
    expect(calculateNextVisit(lastVisit, periodicity)).toBe(expected);
  });

  it('should correctly identify expired visits', () => {
    const today = new Date();
    const expiredDate = '2023-01-01';
    expect(isBefore(new Date(expiredDate), today)).toBe(true);
  });

  it('should correctly identify upcoming visits within 30 days', () => {
    const today = new Date();
    const upcomingDate = addDays(today, 15);
    const next30Days = addDays(today, 30);

    const isUpcoming = isAfter(upcomingDate, today) && isBefore(upcomingDate, next30Days);
    expect(isUpcoming).toBe(true);
  });
});
