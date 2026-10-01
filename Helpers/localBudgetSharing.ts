import { storage } from './storage';

const localSharesKey = '@local_budget_shares';

export type LocalInvitation = {
  id: number;
  email: string;
  budgetId: string;
  budgetName: string;
  invitationStatus: 'pending' | 'accepted' | 'rejected';
  budget: LocalBudgetSnapshot;
};

export type LocalBudgetSnapshot = {
  budgetId: string;
  name: string;
  ownerEmail: string;
  budgetItems: {
    id: string;
    description: string;
    budget: number;
    amount: number;
    date: string;
  }[];
};

function readLocalShares(): LocalInvitation[] {
  try {
    const storedShares = storage.getString(localSharesKey);
    const shares = storedShares ? JSON.parse(storedShares) : [];
    return Array.isArray(shares) ? shares : [];
  } catch {
    return [];
  }
}

function writeLocalShares(shares: LocalInvitation[]): void {
  storage.set(localSharesKey, JSON.stringify(shares));
}

export function listLocalInvitations(email: string): LocalInvitation[] {
  const normalizedEmail = email.trim().toLowerCase();
  return readLocalShares().filter(
    (share) => share.email.toLowerCase() === normalizedEmail && share.invitationStatus === 'pending',
  );
}

export function createLocalInvitation(
  email: string,
  budget: LocalBudgetSnapshot,
): LocalInvitation {
  const shares = readLocalShares();
  const normalizedEmail = email.trim().toLowerCase();
  const remainingShares = shares.filter(
    (share) =>
      !(share.email.toLowerCase() === normalizedEmail &&
        share.budgetId === budget.budgetId &&
        share.invitationStatus === 'pending'),
  );
  const invitation: LocalInvitation = {
    id: Math.max(0, ...shares.map((share) => share.id)) + 1,
    email: normalizedEmail,
    budgetId: budget.budgetId,
    budgetName: budget.name,
    invitationStatus: 'pending',
    budget: {...budget, budgetItems: [...budget.budgetItems]},
  };
  writeLocalShares([...remainingShares, invitation]);
  return invitation;
}

export function updateLocalInvitation(
  id: number,
  email: string,
  status: 'accepted' | 'rejected',
): LocalInvitation {
  const normalizedEmail = email.trim().toLowerCase();
  const shares = readLocalShares();
  const invitation = shares.find(
    (share) =>
      share.id === id &&
      share.email.toLowerCase() === normalizedEmail &&
      share.invitationStatus === 'pending',
  );
  if (!invitation) throw new Error('Pending invitation not found.');

  invitation.invitationStatus = status;
  writeLocalShares(shares);
  return invitation;
}

export function getAcceptedLocalBudget(email: string, budgetId: string): LocalInvitation['budget'] | null {
  const normalizedEmail = email.trim().toLowerCase();
  const invitation = readLocalShares().find(
    (share) =>
      share.email.toLowerCase() === normalizedEmail &&
      share.budgetId === budgetId &&
      share.invitationStatus === 'accepted',
  );
  return invitation?.budget ?? null;
}