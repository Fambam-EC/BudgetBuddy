import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  StatusBar,
  Alert,
  Button
} from "react-native";

import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <BudgetComponent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <Text>Budget Buddy!</Text>
    </View>
  );
}
const budgetDataItems = [
  { id: '1', description: 'Groceries', budget: 300, amount: -150.75, date: '2025-12-28' },
  { id: '2', description: 'Salary', budget: 300, amount: 3000.00, date: '2025-12-27' },
  { id: '3', description: 'Coffee', budget: 300, amount: -4.50, date: '2025-12-27' },
  { id: '4', description: 'Dinner out', budget: 300, amount: -65.00, date: '2025-12-26' },
];
type BudgetData = {
    id: string;
    description: string;
    budget: number;
    amount: number;
    date: string;
};
const BudgetItem = ({id, description, budget, amount, date}: BudgetData) => (
  <View style={[styles.budgetContainer, styles.rowBorder, styles.rowPadding]}>
    <Text style={styles.budgetHeader}>{description}</Text>
    <Text>{amount}</Text>
    <Text>{date}</Text>
  </View>
);
function HomeScreen(){
    return (<View style={styles.container}>
            <BudgetComponent/>
            <Button title="Login"
    onPress={() => ("string")}/>
            </View>);
}
function BudgetHeader(){
    return (
      <View style={[styles.container, styles. rowPadding]}>
        <Text>Total Budget Amount:</Text>
        <Text>$2500</Text>
      </View>
    );
}
function BudgetComponent(){
    return (
      <View>
        <BudgetHeader />
        <FlatList
            data={budgetDataItems}
            renderItem={({item}) => <BudgetItem
                id={item.id}
                description={item.description}
                budget={item.budget}
                amount={item.amount}
                date={item.date}
                />}
            keyExtractor={item => item.id}
            />
      </View>);
}

const styles = StyleSheet.create({
    container:{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    loginButton:{
        flex:1,
    },
    budgetContainer:{
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: 10
    },
    cell: {
        flex: 1,
        padding: 8,
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'center',
        borderRadius: 10
    },
    budgetHeader:{
        fontSize: 18,
        fontWeight: 'bold'
    },
    rowBorder: {
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'center',
        borderRadius: 10
    },
    rowPadding: {
        padding: 10,
        marginVertical: 8,
        marginHorizontal: 16
    }
});
export default App;