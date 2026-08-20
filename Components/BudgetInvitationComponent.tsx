import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import Ionicons from 'react-native-vector-icons/Ionicons';

function BudgetInvitationComponent() {
  return (
    <View style={[styles.flexStart]}>
      <Text style={[styles.rowBorder, styles.rowPadding, styles.boldText, styles.customFont]}>Budget Invitations
      <Pressable onPress={() => {
        // Handle press event
        console.log('Check pressed');
      }}>
        <Icon name="refresh" size={20} color="#17b53c" />
        <Ionicons name="american-football" size={20} color="#17b53c" />
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