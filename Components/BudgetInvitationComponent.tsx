import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { RefreshIcon } from '@hugeicons/core-free-icons';


function BudgetInvitationComponent() {
  return (
    <View style={[styles.flexStart]}>
      <Text style={[styles.rowBorder, styles.rowPadding, styles.boldText, styles.customFont]}>Budget Invitations
      <Pressable onPress={() => {
        // Handle press event
        console.log('Check pressed');
      }}>
        <HugeiconsIcon
        icon={RefreshIcon}
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