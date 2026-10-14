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
  }, [email, localOnly]);

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
        accessibilityState={{ busy: isLoading, disabled: isLoading }}
        onPress={loadInvitations}
        disabled={isLoading}
        style={({ pressed }) => [styles.invitationButton, pressed && styles.pressed]}
      >
        <Text style={styles.headingText}>Budget Invitations</Text>
        {invitations.length > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{invitations.length}</Text>
          </View>
        )}
        <View style={styles.refreshIcon}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#176b45" />
          ) : (
            <HugeiconsIcon icon={RefreshCwIcon} size={16} color="#176b45" strokeWidth={1.8} />
          )}
        </View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {invitations.map((invitation) => (
        <View key={invitation.id} style={styles.invitationCard}>
          <Text style={styles.budgetName} numberOfLines={2}>{invitation.budgetName}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busyInvitationId !== null }}
              disabled={busyInvitationId !== null}
              onPress={() => updateInvitation(invitation, 'accepted')}
              style={({ pressed }) => [
                styles.actionButton,
                styles.acceptButton,
                busyInvitationId !== null && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              {busyInvitationId === invitation.id && <ActivityIndicator size="small" color="#176b45" />}
              <Text style={styles.accept}>
                {busyInvitationId === invitation.id ? 'Working...' : 'Accept'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busyInvitationId !== null }}
              disabled={busyInvitationId !== null}
              onPress={() => updateInvitation(invitation, 'rejected')}
              style={({ pressed }) => [
                styles.actionButton,
                styles.declineButton,
                busyInvitationId !== null && styles.disabledButton,
                pressed && styles.pressed,
              ]}
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
  container: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
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
  },
  headingText: { color: '#1F2937', fontFamily: 'OpenSans-Regular', fontSize: 12, fontWeight: 'bold' },
  pendingBadge: {
    backgroundColor: '#E8F5EE',
    borderRadius: 8,
    marginLeft: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingBadgeText: { color: '#176B45', fontFamily: 'OpenSans-Bold', fontSize: 10 },
  refreshIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    minHeight: 18,
    minWidth: 18,
  },
  invitationCard: {
    alignItems: 'center',
    borderColor: '#000',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 8,
    marginVertical: 3,
    padding: 8,
  },
  budgetName: { color: '#1F2937', flex: 1, fontFamily: 'OpenSans-Bold', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 6 },
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 8,
  },
  acceptButton: {
    backgroundColor: '#F0F8FF',
    borderColor: '#176B45',
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#999',
  },
  accept: { color: '#176B45', fontFamily: 'OpenSans-Bold', fontSize: 11 },
  reject: { color: '#555', fontFamily: 'OpenSans-Bold', fontSize: 11 },
  disabledButton: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
  error: {
    color: '#B42318',
    fontFamily: 'OpenSans-Regular',
    fontSize: 12,
    marginHorizontal: 8,
    marginVertical: 4,
  },
});

export default BudgetInvitationComponent;
