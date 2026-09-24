import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Refresh03Icon } from '@hugeicons/core-free-icons';

const apiUrl = 'https://onset-theatrics-subway.ngrok-free.dev';

type Invitation = {
  id: number;
  budgetId: string;
  budgetName: string;
  invitationStatus: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
};

function BudgetInvitationComponent({ email }: { email: string }) {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const handleCheckInvites = useCallback(async () => {
    if (!email.trim()) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}/invites?email=${encodeURIComponent(email.trim())}`,
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to load invitations.');
      }
      setInvites(result);
    } catch (error) {
      Alert.alert(
        'Unable to load invitations',
        error instanceof Error ? error.message : 'Please try again later.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  useEffect(() => {
    void handleCheckInvites();
  }, [handleCheckInvites]);

  const updateInvitation = async (invite: Invitation, status: 'accepted' | 'rejected') => {
    setUpdatingId(invite.id);
    try {
      const response = await fetch(`${apiUrl}/invites/${invite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, status }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to update invitation.');
      }
      setInvites((currentInvites) =>
        currentInvites.filter((currentInvite) => currentInvite.id !== invite.id),
      );
      Alert.alert(
        status === 'accepted' ? 'Budget accepted' : 'Invitation rejected',
        status === 'accepted'
          ? `"${invite.budgetName}" was added to your accepted budgets.`
          : 'The budget invitation was rejected.',
      );
    } catch (error) {
      Alert.alert(
        'Unable to update invitation',
        error instanceof Error ? error.message : 'Please try again later.',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <View style={[styles.flexStart]}>
      <View style={[styles.rowBorder, styles.rowPadding, styles.invitationHeader]}>
        <Text style={[styles.boldText, styles.customFont]}>Budget Invitations</Text>
        <Pressable onPress={handleCheckInvites} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" />
          ) : (
            <HugeiconsIcon icon={Refresh03Icon} />
          )}
        </Pressable>
      </View>
      {invites.map((invite) => (
        <View key={invite.id} style={styles.inviteCard}>
          <Text style={styles.customFont}>{invite.budgetName}</Text>
          <Text style={styles.inviteId}>Budget ID: {invite.budgetId}</Text>
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => updateInvitation(invite, 'accepted')}
              disabled={updatingId !== null}
            >
              <Text style={styles.buttonText}>Accept</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => updateInvitation(invite, 'rejected')}
              disabled={updatingId !== null}
            >
              <Text style={styles.buttonText}>Reject</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Add your styles here
    rowBorder: {
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 10
        },
    rowPadding: {
        padding: 10,
        marginVertical: 4,
        marginHorizontal: 8
        },
    boldText: {
        fontWeight: 'bold'
        },
    customFont: {
        fontFamily: 'OpenSans-Regular',
        fontSize: 12
        },
    flexStart: {
        justifyContent: 'flex-start',
        alignItems: 'flex-start'
        },
    invitationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: 220,
    },
    inviteCard: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        padding: 10,
        marginHorizontal: 8,
        marginTop: 6,
        minWidth: 220,
    },
    inviteId: {
        color: '#6B7280',
        fontSize: 11,
        marginTop: 4,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    actionButton: {
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    acceptButton: {
        backgroundColor: '#16A34A',
    },
    rejectButton: {
        backgroundColor: '#DC2626',
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 12,
    },
});

export default BudgetInvitationComponent;