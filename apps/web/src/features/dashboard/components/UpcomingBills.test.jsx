/**
 * Ticking a bill off.
 *
 * The checkbox is the part worth testing, because a checkbox that only looks
 * checked is worse than none at all: the person believes the bill is dealt
 * with, and it is still sitting there next time they look.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../../shared/i18n/I18nProvider';
import UpcomingBills from './UpcomingBills';

const markPaid = vi.fn();
vi.mock('../../expenses', () => ({
  expensesApi: { markPaid: (...args) => markPaid(...args) },
}));

const notifyDataChanged = vi.fn();
vi.mock('../../../shared/hooks/useAsync', () => ({
  notifyDataChanged: (...args) => notifyDataChanged(...args),
  default: () => ({ data: null, loading: false, error: null, reload: () => {} }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const bills = [
  { _id: 'b1', description: 'Bijli bill', category: 'electricity_bill', amount: 9500, nextRunAt: '2099-01-08' },
  { _id: 'b2', description: '', category: 'house_rent', amount: 35000, nextRunAt: '2099-01-02' },
];

const show = (props = {}, language = 'en') =>
  render(
    <I18nProvider language={language}>
      <UpcomingBills bills={bills} currency="PKR" {...props} />
    </I18nProvider>
  );

beforeEach(() => {
  markPaid.mockReset().mockResolvedValue({ nextDueAt: '2099-02-08' });
  notifyDataChanged.mockReset();
});

describe('the list', () => {
  it('shows each bill with what it is and what it costs', () => {
    show();
    expect(screen.getByText('Bijli bill')).toBeInTheDocument();
    expect(screen.getByText('Rs 35,000')).toBeInTheDocument();
  });

  it('falls back to the category label when a bill has no description', () => {
    // Never the stored id: "house_rent" on screen reads as broken data.
    show();
    expect(screen.getByText('House Rent')).toBeInTheDocument();
  });

  it('says plainly when there is nothing due', () => {
    show({ bills: [] });
    expect(screen.getAllByText(/Nothing due in the coming weeks/i).length).toBeGreaterThan(0);
  });
});

describe('ticking a bill off', () => {
  it('offers a check control for every bill', () => {
    show();
    expect(screen.getByRole('button', { name: /Mark Bijli bill as paid/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark House Rent as paid/i })).toBeInTheDocument();
  });

  it('records the payment against that bill', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: /Mark Bijli bill as paid/i }));

    await waitFor(() => expect(markPaid).toHaveBeenCalledWith('b1'));
  });

  it('tells the rest of the dashboard the numbers moved', async () => {
    // What is spent, what is left and this list all just changed. Without the
    // broadcast the bill stays on screen until the next navigation, which
    // reads as the tick having done nothing.
    show();
    await userEvent.click(screen.getByRole('button', { name: /Mark Bijli bill as paid/i }));

    await waitFor(() => expect(notifyDataChanged).toHaveBeenCalled());
  });

  it('does not claim success when the request fails', async () => {
    markPaid.mockRejectedValue(new Error('nope'));
    show();

    await userEvent.click(screen.getByRole('button', { name: /Mark Bijli bill as paid/i }));

    await waitFor(() => expect(markPaid).toHaveBeenCalled());
    // The list is untouched, so the person can see it did not go through.
    expect(screen.getByText('Bijli bill')).toBeInTheDocument();
    expect(notifyDataChanged).not.toHaveBeenCalled();
  });

  it('labels the control in Roman Urdu too', () => {
    show({}, 'roman_ur');
    expect(
      screen.getByRole('button', { name: /Bijli bill ko ada shuda nishan zad karein/i })
    ).toBeInTheDocument();
  });
});
