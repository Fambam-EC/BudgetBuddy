import React, { useEffect, useState } from "react";
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
  Pressable,
  ScrollView,
  TextComponent
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatePicker from './Helpers/DatePicker';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { NavigationContainer, useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

function RightAction(prog: SharedValue<number>, drag: SharedValue<number>, itemId: string, callDelete:(deleteId: string) => void) {
  const styleAnimation = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: drag.value + 50 }],
    };
  });
  return (
    <Reanimated.View style={[styleAnimation, styles.center]}>
      <Pressable style={[styles.rightAction, styles.center]}
      onPress={() => {
        callDelete(itemId)
        }
        }>
        <Text style={[styles.center]}>Delete?</Text></Pressable>
    </Reanimated.View>
  );
}

const title_key = '@title_key'; 
const budget_items_key = '@budget_items_key';

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
          <GestureHandlerRootView>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <NavigationContainer>
        <TableWrapper item={<RootStack/>}/>
      </NavigationContainer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

type BudgetData = {
    id: string;
    description: string;
    budget: number;
    amount: number;
    date: string;
    onDeleteConfirm?: (id: string) => void;
    addAmount?: (amount: number) => void;
    adjustBudgetAmount?: (amount: number) => void;
    updateBudgetDescription?: (description: string) => void;
};

type RootStackParamList = {
  'Budget Buddy': any,
  History: any
}

const todaysDate = new Date();
let totalIncomeAmount = 2000;
let budgetRemaining = Number(0);
let totalBudgetAmount = Number(0);

const BudgetItem = ({id, description, budget, amount, date, onDeleteConfirm, addAmount, adjustBudgetAmount, updateBudgetDescription}: BudgetData) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [amountAdded, setAmountAdded] = useState<number>(0);
  const [editableBudget, setEditableBudgetAmount] = useState<number>(budget);
  const [dueDate, setDueDate] = useState<string>(date);
  const [isEditingDueDate, setIsEditingDueDate] = useState<boolean>(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState<boolean>(true);
  const [budgetDescription, setBudgetDescription] = useState<string>(description);
  const toggleEdit = () => {
      setIsEditing(!isEditing);
  }
  const callDeleteWithId = (itemId: string) => {
    onDeleteConfirm && onDeleteConfirm(id)
  }
  return (
      <ReanimatedSwipeable
        friction={2}
        enableTrackpadTwoFingerGesture
        rightThreshold={40}
        renderRightActions={(progress, drag) => (RightAction(progress, drag, id, () => callDeleteWithId(id)))}
        >
  <View style={[styles.budgetContainer, styles.rowBorder, styles.rowPadding, styles.rowContainer, styles.flex]}>
    {/* <Text style={[styles.budgetHeader, styles.rowContent, styles.customFont]}>{description}</Text> */}
    <TextInput
      style={[styles.rowContent, styles.customFont, styles.zeroWidthForPadding]}
      value={budgetDescription}
      onChangeText={(text) => {
        setBudgetDescription(text)
      }}
      onSubmitEditing={() =>{
        updateBudgetDescription && updateBudgetDescription(budgetDescription)
      }}
     />
    {/* <Text style={[styles.rowContent, styles.customFont]}>{editableBudget}</Text> */}
    <TextInput
      style={[styles.rowContent, styles.customFont, styles.zeroWidthForPadding]}
      value={editableBudget.toString()}
      placeholder={editableBudget.toString()}
      keyboardType={'numeric'}
      onChangeText={(text) => {
        setEditableBudgetAmount(Number(text))
      }}
      onSubmitEditing={() => {
        adjustBudgetAmount && adjustBudgetAmount(Number(editableBudget))
      }}
      />
    <View style={[styles.flex, styles.center, styles.zeroWidthForPadding]}>
      <Text style={[styles.customFont]}>{amount}</Text>
    </View>
    <Pressable 
      style={[styles.rowContent, styles.zeroWidthForPadding]}
      onLongPress={() => {
      setIsEditingDueDate(true)
      }
    }>{isEditingDueDate && (
      <View style={[styles.rowContent, styles.zeroWidthForPadding]}>
        <DatePicker
          value={new Date(date)}
          onChange={(selectedDate: Date) => {
            setDueDate(selectedDate.toISOString().split('T')[0])
            setIsEditingDueDate(false)
          }}
        />
      </View>
    )}{ !isEditingDueDate && (
      <View style={styles.rowContent}>
    <Text style={[styles.rowContent, styles.customFont]}>{new Date(dueDate)?.toISOString().split('T')[0].replace('/', '-').substring(5) ?? new Date()}</Text>
      </View>
    )}
    </Pressable>
    <Pressable style={styles.rowContent} onPress={() => {
      toggleEdit()
      }}>{!isEditing &&
      <Text style={[styles.rowContent, styles.customFont, styles.bigCross]}>+</Text>}
      {isEditing && (
      <TextInput
      style={{textAlign: 'center'}}
      keyboardType={'numeric'}
      autoFocus={true}
      onChangeText={(text) => setAmountAdded(Number(text))}
      onSubmitEditing={() => {
      addAmount && addAmount(amountAdded)
      toggleEdit()
      setAmountAdded(0)
        }
      }/>
      )}
    </Pressable>
  </View>
  </ReanimatedSwipeable>
)};

function HistoryScreen ({navigation}: {navigation: any}){
  const homeString: string = 'Home';
  const [date, setDate] = useState<Date>(new Date());
    return (<View>
        <Text style={[styles.customFont]}>History Screen</Text>
        <Pressable onPress={() => navigation.popTo('Budget Buddy')}>
          <Text style={styles.customFont}>Back To Home</Text>
        </Pressable>

    </View>);
}

async function GetBudgetTitle(){
  return await AsyncStorage.getItem(title_key).then((value) => {
    return value
  })
  .catch(error => {
    return error
  })
}

async function GetBudgetItemsFromStorage(){
  return await AsyncStorage.getItem(budget_items_key)
  .then((value) =>{
    console.log(value)
    return value
  })
  .catch((error) =>{
    console.log(error)
  })
}


async function GetBudgetItems() {
  try{
    await AsyncStorage.getItem(budget_items_key)
      .then(value =>{
        if (value){
        return JSON.parse(value);
        }
        else return []
      })
  } catch(error){
    console.log(error)
    return []
  }
}

async function SaveBudgetItems(budgetItems: BudgetData[]){
  try{
    const budgetItemsResponse = JSON.stringify(budgetItems)
    console.log("Saving Budget Items")
    console.log(budgetItemsResponse)
    await AsyncStorage.setItem(budget_items_key, budgetItemsResponse)
  }catch (error) {
    console.log(error)
  }
}

function BudgetHeader( {budgetAmountRemaining, budgetedTotal}: {budgetAmountRemaining?: number, budgetedTotal?: number}){
  const [totalSetBudgetAmount, setTotalBudgetAmount] = useState(totalIncomeAmount);
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [budgetTitle, setBudgetTitle] = useState<string>('');

  useEffect(()=> {
    const getTitle = async () => {
      try{
        const result = await GetBudgetTitle()
        if (result){
          setBudgetTitle(result)
        }
      }
      catch (error){
        console.log(error)
      }
    };
    getTitle();
  }, [])

  const [potentialSurplus, setPotentialSurplus] = useState(totalSetBudgetAmount - (budgetedTotal ? budgetedTotal : 0));

  const updateBudgetTitle = (text: string) => {
    AsyncStorage.setItem(title_key, text)
    setBudgetTitle(text);
  }

    return (
        <View style={[styles.container, styles.tableHeaderPadding]}>
        <TextInput
        style={[styles.customFont, styles.headerFontSize, {textAlign: 'center'}]}
        value={budgetTitle}
        placeholder="Click to Update Title"
        onChangeText={(text) => {
          setBudgetTitle(text)
        }
      }
        onSubmitEditing={() => updateBudgetTitle(budgetTitle)}
        />
        <Text style={[styles.customFont, styles.headerFontSize]}>{todaysDate.toDateString()}</Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Total Income: $ <View style={styles.center}><TextInput
        style={[styles.zeroWidthForPadding, styles.headerFontSize]}
        placeholder="Total Income"
        keyboardType={'number-pad'}
        value={totalSetBudgetAmount.toFixed(2).toString()}
        onChangeText={(amount) => setTotalBudgetAmount(Number(amount))}
        onSubmitEditing={() => {
          setTotalBudgetAmount(Number(totalSetBudgetAmount))
          setPotentialSurplus(totalSetBudgetAmount - (budgetedTotal ? budgetedTotal : 0))
          setIsEditingTotal(false)
        }}
        /></View>
        </Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Budget Total: $ {budgetedTotal?.toFixed(2)}</Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Remaining: $ {budgetAmountRemaining?.toFixed(2)}</Text>
        <View style={[styles.row, styles.center]}>
        <Text style={[styles.customFont, styles.headerFontSize
        ]}>Surplus: $ </Text><Text style={[styles.flexEnd, styles.headerFontSize, {color: potentialSurplus > 0 ? 'green' : 'red'}]}>{potentialSurplus.toFixed(2)}</Text>
        </View>
      </View>
    );
}


function TableHeader(){
  return (<View style={[styles.rowContainer, styles.rowPadding, styles.tableHeaderPadding]}>
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
  const [budgetSetDate, setBudgetSetDate] = useState<Date>(new Date());
  const [budgetAmount, setBudgetAmount] = useState<number>(0);
  const [isAddingItem, setIsAddingItem] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const toggleAddItem = () => {
      setIsAddingItem(!isAddingItem);
  }

  const isInvalidEntry = () => {
    if(budgetDescription.trim() === '' || budgetAmount <= 0 || !budgetSetDate){
      return true;
    }
  }
  React.useEffect(() => {
    setNewBudgetItem({
      id: '',
      description: budgetDescription,
      budget: budgetAmount,
      amount: 0,
      date: budgetSetDate.toISOString().split('T')[0]
    });
  }, [budgetDescription, budgetAmount, budgetSetDate]);
  return (
    <View>
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
          {/* <TextInput
            placeholder="Due Date (YYYY-MM-DD)"
            value={budgetDate}
            onChangeText={(text) => setBudgetDate(text)}
            style={[styles.rowContent, styles.zeroWidthForPadding]}
          /> */}
          <View style={[styles.rowContent, styles.zeroWidthForPadding]}>
          <DatePicker
            value={budgetSetDate}
            selectedDate={budgetSetDate}
            onChange={(selectedDate: Date) => {
              let utcDate = selectedDate.toUTCString();
              setBudgetSetDate(new Date(utcDate));
            }}
          />
          </View>
          <Pressable
          style={[styles.rowContent, styles.center, styles.zeroWidthForPadding]}
            onPress={() => {
              if(isInvalidEntry()){
                setShowError(true);
                return;
              }
              setShowError(false);
              addBudgetItem(newBudgetItem);
              setIsAddingItem(false);
              setNewBudgetItem({id: '', description: '', budget: 0, amount: 0, date: new Date(budgetSetDate).toISOString().split('T')[0]});
            }}>
            <Text style={[styles.boldText, styles.budgetHeader]}>Add</Text>
              </Pressable>
    </View>
      )}
      {showError && isAddingItem && (
        <View style={[styles.rowBorder, styles.rowPadding, styles.center]}>
          <Text style={[styles.customFont, styles.boldText, styles.errorText]}>Invalid Entry</Text>
        </View>
      )}
      <View style={[styles.center]}>
      <Pressable onPress={() => toggleAddItem()}>
        <Text style={[styles.rowPadding, styles.rowBorder, styles.customFont, styles.boldText]}>Add Budget Item</Text>
      </Pressable>
      </View>
    </View>
  );
}
function BudgetComponent({navigation}: {navigation: any}){
  // TODO : Fetch budget data from API or local storage
  let budgetDataItems: BudgetData[] = [], currentBudgetData

 

  useEffect(() => {
    const getCurrentBudget = async () =>{
      try {
        const result = await AsyncStorage.getItem(budget_items_key)
        if (result){
          console.log("Get Current Budget - ",result)
          const items = JSON.parse(result) as BudgetData[]
          return setBudgetData(items)
        }
      }
      catch (error) {
        console.log(error)
      }
    }; getCurrentBudget()
  }, [])

 const [budgetData, setBudgetData] = useState<BudgetData[]>(budgetDataItems);

  const updateBudgetAmountUsed = (id: string, newAmount: number) => {
      const updatedItem = budgetData.map(item => {
          if(item.id === id){
              return {...item, amount: newAmount + item.amount};
          }
          return item;
      });
      setBudgetData(updatedItem);
      SaveBudgetItems(updatedItem);
  };

  const updateBudgetAmount = (id: string, newAmount: number) => {
    const updatedItem = budgetData.map(item => {
          if(item.id === id){
              return {...item, budget: newAmount};
          }
          return item;
      });
      setBudgetData(updatedItem);
      SaveBudgetItems(updatedItem);
  };

  const updateBudgetDescription = (id: string, newDescription: string) =>{
    const updatedItem = budgetData.map(item => {
      if (item.id === id){
        return {...item, description: newDescription};
      }
      return item;
    });
    setBudgetData(updatedItem);
    SaveBudgetItems(updatedItem);
  };
  

const removeBudgetItem = (id: string) => {
  const updatedBudget = budgetData.filter(item => item.id !== id)
  setBudgetData(updatedBudget);
  SaveBudgetItems(updatedBudget);
};

const addBudgetItem = (budgetItem: BudgetData) =>{
  const largestExistingId = budgetData.reduce((maxId, item) => Math.max(maxId, parseInt(item.id)), 0);
    const itemWithId = { ...budgetItem, id: (largestExistingId + 1).toString() };
              let budgetDataWithAddedItem = budgetData.concat(itemWithId)
              setBudgetData(budgetDataWithAddedItem);
              SaveBudgetItems(budgetDataWithAddedItem);              
}

  totalBudgetAmount = budgetData.reduce((acc, item) => acc + item.budget, 0);
  budgetRemaining = totalBudgetAmount - budgetData.reduce((acc, item) => acc + item.amount, 0);
    return (
            <View style={{flex: 1}}>
            <HistoryButton navigation={navigation}/>
            <View style={{flex: 1, minHeight: 20, margin: 50}}>
            <BudgetHeader
                budgetAmountRemaining={budgetRemaining}
                budgetedTotal={totalBudgetAmount}/>
            </View>
            <TableHeader />
        <FlatList
            data={budgetData}
            renderItem={({item}) => <BudgetItem
              id={item.id}
              description={item.description}
              budget={item.budget}
              amount={item.amount}
              date={item.date}
              addAmount={(amount: number) => {
                updateBudgetAmountUsed(item.id, amount)
              }}
              adjustBudgetAmount={(amount: number) => {updateBudgetAmount(item.id, amount)}}
              onDeleteConfirm={(id: string) => {
                removeBudgetItem(item.id)
              }}
              updateBudgetDescription={(description: string) => {
                updateBudgetDescription(item.id, description)
              }}
                  /> }
            keyExtractor={item => item.id}
            numColumns={1}
            //extraData={[budgetData, FooterComponent]}
            ListFooterComponent={<FooterComponent addBudgetItem={(newItem: BudgetData) => {
              addBudgetItem(newItem)
            }} />}
            /><View style={[styles.container, styles.rowPadding]}>
              <Pressable 
                onPress={() => SaveBudgetItems(budgetData)}>
                <Text>Close and Move to History</Text>
              </Pressable>
            </View>
      </View>);
}

function HistoryButton({navigation}: {navigation: any}){
    //const navigation = useNavigation();
    return (<View style={[styles.flexEnd]}>
            <Pressable onPress={() => navigation.navigate('History')}>
              <Text style={[styles.rowPadding, styles.rowBorder, styles.customFont, styles.boldText]}>Go To History</Text>
            </Pressable>
            </View>);
}

function TableWrapper({item} : {item: any}) {
    return (<View id='TableWrapper' style={styles.flex}>{item}</View>);
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
      width: 61,
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
    },
    flex:{
      flex: 1,
    },
  rightAction: { width: 50, height: 48, backgroundColor: 'red', borderRadius: 10 },
  separator: {
    width: '100%',
    borderTopWidth: 1,
  },
  swipeable: {
    height: 50,
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
  },
  tableHeaderPadding:{
    marginTop: 15
  }
});
export default App;
