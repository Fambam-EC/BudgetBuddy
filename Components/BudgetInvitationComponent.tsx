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
      <View style={styles.panel}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <View style={styles.titleRow}>
              <Text style={styles.headingText}>Budget invitations</Text>
              {invitations.length > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>
                    {invitations.length} pending
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.subtitle}>Shared budgets waiting for you</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh budget invitations"
            accessibilityState={{ busy: isLoading, disabled: isLoading }}
            onPress={loadInvitations}
            disabled={isLoading}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#176b45" />
            ) : (
              <HugeiconsIcon icon={RefreshCwIcon} size={18} color="#176b45" strokeWidth={1.8} />
            )}
          </Pressable>
        </View>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
        {invitations.length > 0 ? (
          <View style={styles.invitationList}>
            {invitations.map((invitation) => (
              <View key={invitation.id} style={styles.invitationCard}>
                <View style={styles.invitationDetails}>
                  <Text style={styles.invitationLabel}>BUDGET INVITATION</Text>
                  <Text style={styles.budgetName} numberOfLines={2}>
                    {invitation.budgetName}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busyInvitationId !== null }}
                    disabled={busyInvitationId !== null}
                    onPress={() => updateInvitation(invitation, 'accepted')}
                    style={({ pressed }) => [
                      styles.acceptButton,
                      busyInvitationId !== null && styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {busyInvitationId === invitation.id && (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    )}
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
        ) : !error && !isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyText}>New budget invitations will show up here.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    maxWidth: 420,
    minWidth: 280,
    width: '100%',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E7F2',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: { flex: 1, paddingRight: 12 },
  titleRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  headingText: { color: '#1F2937', fontFamily: 'OpenSans-Bold', fontSize: 15 },
  subtitle: { color: '#6B7280', fontFamily: 'OpenSans-Regular', fontSize: 12, marginTop: 3 },
  pendingBadge: {
    backgroundColor: '#E8F5EE',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingBadgeText: { color: '#176B45', fontFamily: 'OpenSans-Bold', fontSize: 10 },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  invitationList: { gap: 9, marginTop: 14 },
  invitationCard: {
    backgroundColor: '#F7FAFC',
    borderColor: '#E5EDF3',
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  invitationDetails: { gap: 3 },
  invitationLabel: { color: '#6B7280', fontFamily: 'OpenSans-Bold', fontSize: 9, letterSpacing: 0.6 },
  budgetName: { color: '#1F2937', fontFamily: 'OpenSans-Bold', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptButton: {
    alignItems: 'center',
    backgroundColor: '#176B45',
    borderRadius: 9,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  declineButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EDF3',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  accept: { color: '#FFFFFF', fontFamily: 'OpenSans-Bold', fontSize: 12 },
  reject: { color: '#6B7280', fontFamily: 'OpenSans-Bold', fontSize: 12 },
  disabledButton: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
  emptyState: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    marginTop: 14,
    padding: 13,
  },
  emptyTitle: { color: '#374151', fontFamily: 'OpenSans-Bold', fontSize: 13 },
  emptyText: { color: '#6B7280', fontFamily: 'OpenSans-Regular', fontSize: 12, marginTop: 3 },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    marginTop: 12,
    padding: 10,
  },
  error: { color: '#B42318', fontFamily: 'OpenSans-Regular', fontSize: 12 },
});

export default BudgetInvitationComponent;
