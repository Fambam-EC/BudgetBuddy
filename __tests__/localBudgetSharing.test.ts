jest.mock('../Helpers/storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

import { storage } from '../Helpers/storage';
import {
  createLocalInvitation,
  getAcceptedLocalBudget,
  listLocalInvitations,
  updateLocalInvitation,
} from '../Helpers/localBudgetSharing';

const storedValues = new Map<string, string>();

beforeEach(() => {
  storedValues.clear();
  jest.mocked(storage.getString).mockImplementation((key) => storedValues.get(key));
  jest.mocked(storage.set).mockImplementation((key, value) => {
    storedValues.set(key, String(value));
  });
});

test('local invitations can be shared, accepted, and loaded by their recipient', () => {
  const budget = {
    budgetId: 'budget-1',
    name: 'Household',
    ownerEmail: 'owner@example.com',
    budgetItems: [
      {id: '1', description: 'Rent', budget: 1200, amount: 0, date: '2026-10-01'},
    ],
  };

  const invitation = createLocalInvitation('RECIPIENT@example.com', budget);
  expect(listLocalInvitations('other@example.com')).toEqual([]);
  expect(listLocalInvitations('recipient@example.com')).toHaveLength(1);

  updateLocalInvitation(invitation.id, 'recipient@example.com', 'accepted');

  expect(listLocalInvitations('recipient@example.com')).toEqual([]);
  expect(getAcceptedLocalBudget('recipient@example.com', 'budget-1')).toEqual(budget);
  expect(getAcceptedLocalBudget('other@example.com', 'budget-1')).toBeNull();
});