import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Dimensions,
  FlatList,
  useColorScheme,
  StatusBar,
  Alert,
  Button,
  Pressable
} from "react-native";


import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { NavigationContainer, useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootStack(){
  return(<Stack.Navigator initialRouteName="Budget Buddy">
      <Stack.Screen name="Budget Buddy" options={{headerTitle: "Budget Buddy :)", headerTitleStyle:{fontFamily: "OpenSans-Bold"} }} component={BudgetComponent} />
      <Stack.Screen name="History" component={HistoryScreen} />
    </Stack.Navigator>)
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <RootStack />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

type BudgetData = {
    id: string;
    description: string;
    budget: number;
    amount: number;
    date: string;
    onPress?(): void;
    addAmount?: (amount: number) => void;
    adjustBudgetAmount?: (amount: number) => void;
};

type RootStackParamList = {
  'Budget Buddy': any,
  History: any
}

const todaysDate = new Date();
let totalIncomeAmount = 4800;
let budgetRemaining = Number(0);
let totalBudgetAmount = Number(0);

const BudgetItem = ({id, description, budget, amount, date, onPress, addAmount, adjustBudgetAmount}: BudgetData) => { 
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [amountAdded, setAmountAdded] = useState<number>(0);
  const [editableBudget, setEditableBudgetAmount] = useState<number>(budget);
  const toggleEdit = () => {
      setIsEditing(!isEditing);
  }

  return (
  <View style={[styles.budgetContainer, styles.rowBorder, styles.rowPadding, styles.rowContainer]}>
    <Text style={[styles.budgetHeader, styles.rowContent, styles.customFont]}>{description}</Text>
    {/* <Text style={[styles.rowContent, styles.customFont]}>{editableBudget}</Text> */}
    <TextInput
      style={[styles.rowContent, styles.customFont, styles.zeroWidthForPadding]}
      value={editableBudget.toString()}
      placeholder={editableBudget.toString()}
      onChangeText={(text) => setEditableBudgetAmount(Number(text))}
      onSubmitEditing={() => {
        console.log(editableBudget)
        adjustBudgetAmount && adjustBudgetAmount(Number(editableBudget))
      }}
      />
    <Text style={[styles.rowContent, styles.customFont]}>{amount}</Text>
    <Text style={[styles.rowContent, styles.customFont]}>{new Date(date).toLocaleDateString("en-US", { month: '2-digit', day: '2-digit' }).replace("/", "-")}</Text>
    <Pressable style={styles.rowContent} onPress={() => { 
      toggleEdit()
      }}>{!isEditing &&
      <Text style={[styles.rowContent, styles.customFont, styles.bigCross]}>+</Text>}
      {isEditing && (
      <TextInput placeholder={`${amount.toString()}`}
      keyboardType="numeric"
      autoFocus={true} 
      onChangeText={(text) => setAmountAdded(Number(text))}
      onSubmitEditing={() => {
      addAmount && addAmount(amountAdded)
      toggleEdit()
      setAmountAdded(0)
      }}/>
      )}
    </Pressable>
  </View>
)};

function HistoryScreen ({navigation}: {navigation: any}){
  const homeString: string = 'Home';
    return (<View>
        <Text style={[styles.customFont]}>History Screen</Text>
        <Pressable onPress={() => navigation.popTo('Budget Buddy')}>
          <Text style={styles.customFont}>Back To Home</Text>
        </Pressable>
    </View>);
}


function BudgetHeader( {budgetAmountRemaining, budgetedTotal, navigation}: {budgetAmountRemaining?: number, budgetedTotal?: number, navigation: any}){
  const [totalSetBudgetAmount, setTotalBudgetAmount] = useState(totalIncomeAmount);
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [potentialSurplus, setPotentialSurplus] = useState(totalSetBudgetAmount - (budgetedTotal ? budgetedTotal : 0));
    return (
      <View style={[styles.center, styles.rowPadding]}>
        <Text style={[styles.customFont, styles.headerFontSize]}>{todaysDate.toDateString()}</Text>
        <Text style={[styles.customFont, styles.headerFontSize]}> {todaysDate.toISOString().split('T')[0]}</Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Total Income: $ <View style={styles.center}><TextInput 
        style={[styles.zeroWidthForPadding, styles.headerFontSize]}
        placeholder="New Amount"
        keyboardType={'number-pad'}
        value={totalSetBudgetAmount.toString()}
        onChangeText={(amount) => setTotalBudgetAmount(Number(amount))}
        onSubmitEditing={() => {
          setTotalBudgetAmount(Number(totalSetBudgetAmount))
          setPotentialSurplus(totalSetBudgetAmount - (budgetedTotal ? budgetedTotal : 0))
          setIsEditingTotal(false)
        }}
        /></View>
        </Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Budget Total: $ {budgetedTotal}</Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Remaining To Pay: $ {budgetAmountRemaining?.toFixed(2)}</Text>
        <View style={[styles.budgetContainer, styles.center]}>
        <Text style={[styles.customFont, styles.headerFontSize
        ]}>Potential Surplus: $ </Text><Text style={[styles.flexEnd, styles.headerFontSize, {color: potentialSurplus > 0 ? 'green' : 'red'}]}>{potentialSurplus.toFixed(2)}</Text>   
        </View>
      </View>
    );
}


function TableHeader(){
  return (<View style={[styles.rowContainer, styles.rowPadding]}>
          <Text
          style={[styles.boldText, styles.rowContent, styles.customFont]}>Description</Text>
    <Text style={[styles.boldText, styles.rowContent, styles.customFont]}>Budget</Text>
    <Text style={[styles.boldText, styles.rowContent, styles.customFont]}>Paid</Text>
    <Text style={[styles.boldText, styles.rowContent, styles.customFont]}>Due Date</Text>
    <Text style={[styles.boldText, styles.rowContent, styles.customFont]}>Add Amount</Text>
  </View>);
}

function FooterComponent({addBudgetItem}: {addBudgetItem: (arg0: BudgetData) => void}){
  const [newBudgetItem, setNewBudgetItem] = useState<BudgetData>({id: '', description: '', budget: 0, amount: 0, date: ''});
  const [budgetDescription, setBudgetDescription] = useState<string>('');
  const [budgetDate, setBudgetDate] = useState<string>('');
  const [budgetAmount, setBudgetAmount] = useState<number>(0);
  const [isAddingItem, setIsAddingItem] = useState<boolean>(false);
  const toggleAddItem = () => {
      setIsAddingItem(!isAddingItem);
  }
  React.useEffect(() => {
    setNewBudgetItem({
      id: '',
      description: budgetDescription,
      budget: budgetAmount,
      amount: 0,
      date: budgetDate
    });
  }, [budgetDescription, budgetAmount, budgetDate]);
  return (
    <View style={[styles.loginButton, styles.center]}>
            {isAddingItem && (
        <View style={[styles.rowBorder, styles.rowPadding, styles.row]}>
          <TextInput
            placeholder="Description"
            value={budgetDescription}
            onChangeText={(text) => setBudgetDescription(text)}
            style={[styles.rowContent, styles.zeroWidthForPadding]}
          />
          <TextInput
            placeholder="Amount"
            keyboardType="numeric"
            value={budgetAmount.toString() }
            onChangeText={(text) => setBudgetAmount(Number(text))}
            style={[styles.rowContent, styles.zeroWidthForPadding]}
          />
          <TextInput
            placeholder="Due Date (YYYY-MM-DD)"
            value={budgetDate}
            onChangeText={(text) => setBudgetDate(text)}
            style={[styles.rowContent, styles.zeroWidthForPadding]}
          />
          <Pressable
          style={[styles.rowContent, styles.center, styles.zeroWidthForPadding]}
            onPress={() => {
              addBudgetItem(newBudgetItem);
              setIsAddingItem(false);
              setNewBudgetItem({id: '', description: '', budget: 0, amount: 0, date: ''});
            }}>
            <Text style={[styles.boldText, styles.budgetHeader]}>+</Text>
              </Pressable>
    </View>       
      )}
      <Pressable onPress={() => toggleAddItem()}>
        <Text style={[styles.rowPadding, styles.rowBorder, styles.customFont, styles.boldText]}>Add Budget Item</Text>
      </Pressable>
    </View>   
  );
}
function BudgetComponent({navigation}: {navigation: any}){
  // TODO : Fetch budget data from API or local storage
   const budgetDataItems = [
  { id: '1', description: 'Internet', budget: 84.35, amount: 0.0, date: '2025-12-20' },
  { id: '2', description: 'Cell Phone', budget: 100, amount: 0.0, date: '2025-12-28' },
  { id: '3', description: 'Mortgage', budget: 590, amount: 0.0, date: '2025-12-28' },
  { id: '4', description: 'Escrow', budget: 375, amount: 0.00, date: '2025-12-28' },
  { id: '5', description: 'Kia Payment', budget: 299.68, amount: 0.00, date: '2025-12-28' },
  { id: '6', description: 'Energy', budget: 300, amount: 0.0, date: '2025-12-17' },
  { id: '7', description: 'Extras', budget: 705, amount: 0.0, date: '2025-12-28' },
  { id: '8', description: 'Fun', budget: 300, amount: 0.0, date: '2025-12-26' },
  { id: '9', description: 'Gas', budget: 300, amount: 0.0, date: '2025-12-28' },
  { id: '10', description: 'Groceries', budget: 300, amount: 0.0, date: '2025-12-27' },
  { id: '11', description: 'Misc', budget: 300, amount: 0.0, date: '2025-12-27' },
  { id: '12', description: 'Savings', budget: 300, amount: 0.0, date: '2025-12-26' },
  { id: '13', description: 'Student Loans', budget: 300, amount: 0.0, date: '2025-12-28' }
];
  const [budgetData, setBudgetData] = useState<BudgetData[]>(budgetDataItems);

  const updateBudgetAmountUsed = (id: string, newAmount: number) => {
      const updatedItem = budgetData.map(item => {
          if(item.id === id){
              return {...item, amount: newAmount + item.amount};
          }
          return item;
      });
      setBudgetData(updatedItem);   
  };

  const updateBudgetAmount = (id: string, newAmount: number) => {
    const updatedItem = budgetData.map(item => {
          if(item.id === id){
              return {...item, budget: newAmount};
          }
          return item;
      });
      setBudgetData(updatedItem); 
  };

  totalBudgetAmount = budgetData.reduce((acc, item) => acc + item.budget, 0);
  budgetRemaining = totalBudgetAmount - budgetData.reduce((acc, item) => acc + item.amount, 0);
    return (
    <View style={styles.loginButton}>
      <HistoryButton navigation={navigation}/>
        <BudgetHeader
            budgetAmountRemaining={budgetRemaining} 
            budgetedTotal={totalBudgetAmount}
            navigation={navigation} />
        <TableHeader />
        <FlatList
            data={budgetData}
            renderItem={({item}) => <BudgetItem
              id={item.id}
              description={item.description}
              budget={item.budget}
              amount={item.amount}
              date={item.date}
              addAmount={(amount: number) => updateBudgetAmountUsed(item.id, amount)}
              adjustBudgetAmount={(amount: number) => updateBudgetAmount(item.id, amount)} 
                  /> }
            keyExtractor={item => item.id}
            numColumns={1}
            //extraData={[budgetData, FooterComponent]}
            ListFooterComponent={<FooterComponent addBudgetItem={(newItem: BudgetData) => {
              const itemWithId = { ...newItem, id: (budgetData.length + 1).toString() };
              setBudgetData([...budgetData, itemWithId]);
            }} />}
            />
      </View>);
}

function HistoryButton({navigation}: {navigation: any}){
    //const navigation = useNavigation();
    return (<View style={styles.flexEnd}>
            <Pressable onPress={() => navigation.navigate('History')}>
              <Text style={[styles.rowPadding, styles.rowBorder, styles.customFont, styles.boldText]}>Go To History</Text>
            </Pressable>
            </View>);
}

function TableWrapper({item} : {item: any}) {
    return (<View>{item}</View>);
}

const styles = StyleSheet.create({
    container:{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    rowContainer:{
      flexDirection: 'row',
      padding: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowContent:{
        flex:1,
        textAlign: 'center',
    },
    loginButton:{
        flex:1,
    },
    titleMargin:{
        marginTop: 20,
    },
    budgetContainer:{
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
    },
    cell: {
        flex: 1,
        padding: 8,
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'left',
        borderRadius: 10
    },
    budgetHeader:{
        fontWeight: 'bold'
    },
    boldText:{
        fontWeight: 'bold'
    },
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
    titlePadding:{
        marginTop: 20
    },
    screenWidthSpec: {
        maxWidth: Dimensions.get('window').width
    },
    center:{
      alignItems: 'center', justifyContent: 'center'
    },
    customFont:{
      fontFamily: 'OpenSans-Regular',
      fontSize: 12
    },
    headerFontSize:{
      fontSize: 18
    },
    zeroWidthForPadding:{
      width: 84,
      flex: 1
    },
    rowColumn:{
      flexDirection: 'column'
    },
    row:{
      flexDirection: 'row'
    },
    headerPadding: {
      paddingStart: 10
    },
    flexEnd:{
      alignItems: 'flex-end'
    },
    bigCross:{
      fontSize: 16,
      fontWeight: 'bold'
    }
});
export default App;
