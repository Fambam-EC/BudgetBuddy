import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Refresh03Icon } from '@hugeicons/core-free-icons';


function BudgetInvitationComponent() {
  const handleCheckInvites = () => {
    // Handle check invites action here
    // Check DB for Invites to share budget
    console.log('Check pressed');
  }
  return (
    <View style={[styles.flexStart]}>
      <Text style={[styles.rowBorder, styles.rowPadding, styles.boldText, styles.customFont]}>Budget Invitations
      <Pressable onPress={() => {
        handleCheckInvites();

      }}>
        <HugeiconsIcon
        icon={Refresh03Icon}
        />
      </Pressable>
      </Text>
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
        } 
});

export default BudgetInvitationComponent;