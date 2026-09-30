import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCwIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { apiHeaders, apiUrl } from '../Helpers/api';
import {
  listLocalInvitations,
  updateLocalInvitation,
  type LocalInvitation,
} from '../Helpers/localBudgetSharing';

type Invitation = Pick<LocalInvitation, 'id' | 'email' | 'budgetId' | 'budgetName'>;

type BudgetInvitationProps = {
  email: string;
  localOnly?: boolean;
  onBudgetAccepted?: (invitation: Invitation) => Promise<void>;
};

function BudgetInvitationComponent({ email, localOnly = false, onBudgetAccepted }: BudgetInvitationProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyInvitationId, setBusyInvitationId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadInvitations = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      if (localOnly) {
        setInvitations(listLocalInvitations(email));
        return;
      }

      const response = await fetch(`${apiUrl}/invites`, {
        headers: apiHeaders(),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to load invitations.');
      }
      setInvitations(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load invitations.');
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const updateInvitation = async (invitation: Invitation, status: 'accepted' | 'rejected') => {
    setBusyInvitationId(invitation.id);
    setError('');
    try {
      if (localOnly) {
        updateLocalInvitation(invitation.id, email, status);
        setInvitations((current) => current.filter((item) => item.id !== invitation.id));
        if (status === 'accepted' && onBudgetAccepted) {
          await onBudgetAccepted(invitation);
        }
        return;
      }

      const response = await fetch(`${apiUrl}/invites/${invitation.id}`, {
        method: 'PATCH',
        headers: apiHeaders(true),
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to update invitation.');
      }
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      if (status === 'accepted' && onBudgetAccepted) {
        await onBudgetAccepted(result);
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update invitation.');
      await loadInvitations();
    } finally {
      setBusyInvitationId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Budget invitations${invitations.length ? `, ${invitations.length} pending` : ''}`}
        accessibilityState={{ busy: isLoading }}
        onPress={loadInvitations}
        disabled={isLoading}
        style={styles.invitationButton}
      >
        <Text style={styles.headingText}>Budget Invitations</Text>
        <View style={styles.refreshIcon}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#176b45" />
          ) : (
            <HugeiconsIcon icon={RefreshCwIcon} size={18} color="#176b45" strokeWidth={1.8} />
          )}
        </View>
        {invitations.length > 0 && <Text style={styles.alertBadge}>!</Text>}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {invitations.map((invitation) => (
        <View key={invitation.id} style={styles.invitation}>
          <Text style={styles.budgetName}>{invitation.budgetName}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busyInvitationId !== null}
              onPress={() => updateInvitation(invitation, 'accepted')}
            >
              <View style={styles.actionContent}>
                {busyInvitationId === invitation.id && <ActivityIndicator size="small" />}
                <Text style={styles.accept}>{busyInvitationId === invitation.id ? 'Working...' : 'Accept'}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busyInvitationId !== null}
              onPress={() => updateInvitation(invitation, 'rejected')}
            >
              <Text style={styles.reject}>Decline</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start' },
  invitationButton: {
    alignItems: 'center',
    borderColor: '#000',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 8,
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'relative',
  },
  headingText: { fontFamily: 'OpenSans-Regular', fontSize: 12, fontWeight: 'bold' },
  refreshIcon: { alignItems: 'center', height: 24, justifyContent: 'center', marginLeft: 10, width: 24 },
  alertBadge: {
    alignItems: 'center',
    backgroundColor: '#b42318',
    borderColor: '#fff',
    borderRadius: 9,
    borderWidth: 1,
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    height: 18,
    lineHeight: 16,
    position: 'absolute',
    right: -7,
    textAlign: 'center',
    top: -7,
    width: 18,
  },
  invitation: { alignItems: 'center', flexDirection: 'row', gap: 16, padding: 10 },
  budgetName: { flex: 1 },
  actions: { flexDirection: 'row', gap: 14 },
  actionContent: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  accept: { color: '#176b45', fontWeight: 'bold' },
  reject: { color: '#a32f2f', fontWeight: 'bold' },
  error: { color: '#a32f2f', padding: 10 },
});

export default BudgetInvitationComponent;
