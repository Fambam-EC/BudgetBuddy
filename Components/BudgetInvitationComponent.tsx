import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiHeaders, apiUrl } from '../Helpers/api';

type Invitation = {
  id: number;
  email: string;
  budgetId: string;
  budgetName: string;
};

type BudgetInvitationProps = {
  email: string;
  onBudgetAccepted?: (invitation: Invitation) => Promise<void>;
};

function BudgetInvitationComponent({ email, onBudgetAccepted }: BudgetInvitationProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyInvitationId, setBusyInvitationId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadInvitations = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
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
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Budget Invitations</Text>
        <Pressable accessibilityRole="button" onPress={loadInvitations} disabled={isLoading}>
          <View style={styles.refreshContent}>
            {isLoading && <ActivityIndicator size="small" />}
            <Text style={styles.refresh}>{isLoading ? 'Loading...' : 'Refresh'}</Text>
          </View>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isLoading && invitations.length === 0 && !error ? (
        <Text style={styles.empty}>No pending invitations</Text>
      ) : null}
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
  headingRow: { alignItems: 'center', flexDirection: 'row' },
  heading: { borderColor: '#000', borderWidth: 1, fontWeight: 'bold', padding: 10 },
  refresh: { color: '#176b45', fontWeight: 'bold', padding: 10 },
  refreshContent: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  invitation: { alignItems: 'center', flexDirection: 'row', gap: 16, padding: 10 },
  budgetName: { flex: 1 },
  actions: { flexDirection: 'row', gap: 14 },
  actionContent: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  accept: { color: '#176b45', fontWeight: 'bold' },
  reject: { color: '#a32f2f', fontWeight: 'bold' },
  empty: { color: '#555', padding: 10 },
  error: { color: '#a32f2f', padding: 10 },
});

export default BudgetInvitationComponent;
