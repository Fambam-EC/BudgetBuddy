import 'react-native-get-random-values';
import React, { useEffect, useState, createContext } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  TextInput,
  Dimensions,
  FlatList,
  useColorScheme,
  StatusBar,
  Alert,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from "react-native";

import { storage }from './Helpers/storage';

import DatePicker from './Helpers/DatePicker';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BudgetShareComponent from './Components/BudgetShareComponent';
import BudgetInvitationComponent from './Components/BudgetInvitationComponent';
import { BudgetProvider } from "./Helpers/BudgetDataContext";
import {v4 as UUID} from 'uuid';
import { apiHeaders, apiUrl, authTokenKey } from './Helpers/api';

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
const budget_key = '@budget_key';
const budgets_key = '@budgets_key';
const transaction_items_key = '@transaction_items_key';
const Stack = createNativeStackNavigator<RootStackParamList>();

function accountStorageKey(key: string, email: string): string {
  return `${key}:${encodeURIComponent(email.trim().toLowerCase())}`;
}

function accountHistoryPrefix(email: string): string {
  return `HI:${encodeURIComponent(email.trim().toLowerCase())}:`;
}

function RootStack({logout, userEmail}: {logout: () => void; userEmail: string}) {
  return(<Stack.Navigator initialRouteName="Budget Buddy">
      <Stack.Screen name="Budget Buddy" options={{headerTitle: "Budget Buddy :)", headerTitleStyle:{fontFamily: "OpenSans-Bold"}, headerStyle:{backgroundColor: '#F0F8FF'}}}>
        {props => <BudgetComponent {...props} onLogout={logout} userEmail={userEmail} />}
      </Stack.Screen>
      <Stack.Screen name="History" options={{headerTitle: "History", headerStyle:{backgroundColor: '#F0F8FF'}}}>
        {props => <HistoryScreen {...props} userEmail={userEmail} />}
      </Stack.Screen>
    </Stack.Navigator>)
}

function SignUpScreen({isActiveToggle}: {isActiveToggle:  () => void}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Missing information', 'Please enter your email and password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Invalid password',
        'Password must be at least 6 characters.'
      );
      return;
    }


    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/register`, {
        method: 'POST',
        headers: apiHeaders(true),
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to create account.');
      }
      Alert.alert('Account created', 'You can now sign in.');
      isActiveToggle();
    } catch (error) {
      Alert.alert('Sign up failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>A</Text>
        </View>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>
          Sign up to get started with your account.
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.showButton}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signUpButton}
          onPress={handleSignUp}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.signUpText}>Sign up</Text>}
        </TouchableOpacity>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={isActiveToggle}>
            <Text style={styles.loginLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ForgotPasswordScreen({onBack}: {onBack: () => void}) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      Alert.alert('Missing information', 'Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/forgot-password`, {
        method: 'POST',
        headers: apiHeaders(true),
        body: JSON.stringify({email: normalizedEmail}),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to send the reset email.');
      }

      Alert.alert(
        'Check your email',
        'If an account exists for that email, a password reset link has been sent.',
        [{text: 'Back to login', onPress: onBack}],
      );
    } catch (error) {
      Alert.alert(
        'Unable to send reset email',
        error instanceof Error
          ? error.message
          : 'Please try again later.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.innerContainer}
    >
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we&apos;ll send you a reset link.
        </Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
        </View>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.loginButton, isSubmitting && styles.disabledButton]}
          onPress={handleForgotPassword}
          disabled={isSubmitting}
        >
          {isSubmitting && <ActivityIndicator color="#FFFFFF" />}
          <Text style={styles.loginButtonText}>
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backToLoginButton} onPress={onBack}>
          <Text style={styles.forgotText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function LoginScreen({ authorized }: { authorized: (token: string, email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [signUpScreenActive, setSignUpScreenActive] = useState(false);
  const [forgotPasswordScreenActive, setForgotPasswordScreenActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: apiHeaders(true),
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to log in.');
      }
      await authorized(result.token, result.user.email);
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      { !signUpScreenActive && !forgotPasswordScreenActive &&
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.innerContainer}
      >

        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>
        {/* Form Inputs */}
        <View style={styles.formContainer}>
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                secureTextEntry={secureTextEntry}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setSecureTextEntry(!secureTextEntry)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>
                  {secureTextEntry ? 'Show' : 'Hide'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => setForgotPasswordScreenActive(true)}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.loginButton, isSubmitting && styles.disabledButton]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Log In</Text>}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => setSignUpScreenActive(true)}>
              <Text style={styles.signUpText}>Sign Up</Text>
            </TouchableOpacity>
            
          </View>
        </View>    
        
      </KeyboardAvoidingView>}
      {signUpScreenActive  && <SignUpScreen isActiveToggle={() => setSignUpScreenActive(false)}/>}
      {forgotPasswordScreenActive && (
        <ForgotPasswordScreen onBack={() => setForgotPasswordScreenActive(false)} />
      )}
    </SafeAreaView>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      const token = storage.getString(authTokenKey);
      if (!token) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const response = await fetch(`${apiUrl}/auth/me`, { headers: apiHeaders() });
        const result = await response.json();
        if (!response.ok) {
          storage.remove(authTokenKey);
        } else if (isMounted) {
          setUserEmail(result.user.email);
          setIsAuthenticated(true);
        }
      } catch {
        storage.remove(authTokenKey);
      } finally {
        if (isMounted) setIsRestoringSession(false);
      }
    };

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthenticated = async (token: string, email: string) => {
    storage.set(authTokenKey, token);
    setUserEmail(email);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    storage.remove(authTokenKey);
    setUserEmail('');
    setIsAuthenticated(false);
  };

  return (
          <SafeAreaProvider>
            <SafeAreaView style={[styles.flex, styles.backgroundColor]}>
          <GestureHandlerRootView>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <NavigationContainer>
        { !isAuthenticated && isRestoringSession && (
          <View style={styles.sessionLoading}>
            <ActivityIndicator size="large" />
            <Text style={styles.sessionLoadingText}>Restoring your session...</Text>
          </View>
        )}
        { !isAuthenticated && !isRestoringSession && <LoginScreen authorized={handleAuthenticated} /> }
       { isAuthenticated && (
         <RootStack
           userEmail={userEmail}
           logout={handleLogout}
         />
       )}
      </NavigationContainer>
      </GestureHandlerRootView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

type Budget = {
  budgetId: string;
  name: string;
  ownerEmail: string;
  budgetItems: BudgetData[];
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
    updateDueDate?: (date: Date) => void;
};

type HistoryItemList = {
  id: string;
  budgetId: string;
  budgetName: string;
  items: HistoryItemModel[];
}
type HistoryItemModel = {
  id: string;
  description: string;
  budget: number;
  amount: number;
  date: string;
}
type RootStackParamList = {
  'Budget Buddy': any,
  History: any
}

const HistoryItem = ({description, budget, amount, date}: HistoryItemModel) => {
  return (
    <View style={[styles.rowContainer, styles.rowPadding, styles.rowBorder, styles.flex]}>
      <Text style={[styles.flex, styles.customFont]}>{description}</Text>
      <Text style={[styles.flex, styles.customFont]}>{budget.toFixed(2)}</Text>
      <Text style={[styles.flex, styles.customFont]}>{amount.toFixed(2)}</Text>
      <Text style={[styles.flex, styles.customFont]}>{new Date(date)?.toISOString().split('T')[0].replace('/', '-').substring(5) ?? new Date()}</Text>
    </View>
  );
}

const todaysDate = new Date();
let totalIncomeAmount = 2000;
let budgetRemaining = Number(0);
let totalBudgetAmount = Number(0);

const BudgetItem = ({id, description, budget, amount, date, onDeleteConfirm, addAmount, adjustBudgetAmount, updateBudgetDescription, updateDueDate}: BudgetData) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [amountAdded, setAmountAdded] = useState<number>(0);
  const [editableBudget, setEditableBudgetAmount] = useState<number>(budget);
  const [dueDate, setDueDate] = useState<Date>(new Date(date));
  const [isEditingDueDate, setIsEditingDueDate] = useState<boolean>(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState<boolean>(true);
  const [budgetDescription, setBudgetDescription] = useState<string>(description);
  const toggleEdit = () => {
      setIsEditing(!isEditing);
  }
  const callDeleteWithId = (itemId: string) => {
    onDeleteConfirm && onDeleteConfirm(id)
  }

  const callAdjustDueDate = (newDate: Date) => {
    updateDueDate && updateDueDate(newDate)
  }

  useEffect(() => {
    setDueDate(new Date(date))
  }, [date])
  
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
    }>{
        isEditingDueDate && (
      <View style={[styles.rowContent, styles.zeroWidthForPadding]}>
        <DatePicker
          value={dueDate}
          selectedDate={dueDate}
          onChange={(selectedDate: Date) => {
            let utcDate = selectedDate.toUTCString();
            setDueDate(new Date(utcDate))
            callAdjustDueDate(selectedDate)
            setIsEditingDueDate(false)
          }}
        />
      </View>
    )}{ !isEditingDueDate && (
      <View style={styles.rowContent}>
    <Text style={[styles.rowContent, styles.customFont]}>{dueDate?.toISOString().split('T')[0].replace('/', '-').substring(5) ?? new Date().toDateString()}</Text>
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

function HistoryComponent({userEmail}: {userEmail: string}){
  const [historyItems, setHistoryItems] = useState<HistoryItemModel[]>([]);
  const [historyItemTitle, setHistoryItemTitle] = useState<string>('');
  const [expandHistoryItem, setExpandHistoryItem] = useState<boolean>(false);
  const [expandedHistoryItemId, setExpandedHistoryItemId] = useState<string>('');
  const [historyItemsWithId, setHistoryItemsWithId] = useState<HistoryItemList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toggleExpandHistoryItem = (id: string) => {
      setExpandedHistoryItemId(id === expandedHistoryItemId ? '' : id);
  };

  const callDeleteHistoryItemWithId = async (id: string) => {
    try {
      if (id.startsWith(accountHistoryPrefix(userEmail))) {
        storage.remove(id);
        setHistoryItemsWithId((current) => current.filter((item) => item.id !== id));
        return;
      }

      const response = await fetch(`${apiUrl}/history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to delete history entry.');
      }
      storage.remove(`${accountHistoryPrefix(userEmail)}${id}`);
      setHistoryItemsWithId(historyItemsWithId.filter(item => item.id !== id));
    }
    catch (error) {
      Alert.alert('Unable to delete history', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  const renderHistoryItem = ({item}: {item: HistoryItemList}) => {
    const isExpanded = item.id === expandedHistoryItemId;
    const trimmedTitle = item.budgetName;
    return (
      <ReanimatedSwipeable
        friction={2}
        enableTrackpadTwoFingerGesture
        rightThreshold={40}
        renderRightActions={(progress, drag) => (RightAction(progress, drag, item.id, () => callDeleteHistoryItemWithId(item.id)))}
        >
        <Pressable onPress={() => toggleExpandHistoryItem(item.id)}>
      <View style={[styles.rowPadding, styles.rowBorder, styles.flex]}>
        { !isExpanded && (
          <View style={[styles.center]}><Text>{trimmedTitle}</Text></View>
        )}
        {isExpanded && (
          <FlatList
            data={item.items}
            renderItem={({item}) => <HistoryItem
              id={item.id}
              description={item.description}
              budget={item.budget}
              amount={item.amount}
              date={item.date}
                  /> }
            keyExtractor={item => item.id}
            numColumns={1}
            ListHeaderComponent={() => <View style={[styles.center]}><Text>{trimmedTitle}</Text></View> }
            />
        )}
      </View>
      </Pressable>
      </ReanimatedSwipeable>
    );
  }
  useEffect(() => {
    const getHistoryItems = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${apiUrl}/history`, { headers: apiHeaders() });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Unable to load budget history.');
        }
        setHistoryItemsWithId(result.map((entry: {
          historyId: string;
          budgetId: string;
          budgetName: string;
          budgetItems: HistoryItemModel[];
        }) => ({
          id: entry.historyId,
          budgetId: entry.budgetId,
          budgetName: entry.budgetName,
          items: entry.budgetItems,
        })));
      }
      catch (error) {
        console.error('Unable to load budget history', error);
        const localHistory = await GetBudgetHistoryItemsFromStorage(userEmail);
        setHistoryItemsWithId(localHistory);
      } finally {
        setIsLoading(false);
      }
    }; getHistoryItems()
  }, [userEmail])
return (<View style={styles.flex}>
  <View style={styles.center}>
  <Text>Budget History</Text>
  </View>
  {isLoading ? (
    <View style={styles.inlineLoading}>
      <ActivityIndicator />
      <Text style={styles.loadingText}>Loading history...</Text>
    </View>
  ) : <FlatList
            data={historyItemsWithId}
            renderItem={renderHistoryItem}
            keyExtractor={item => item.id}
            numColumns={1}
            />}
    </View>);
}

function HistoryScreen({navigation, userEmail}: {navigation: any; userEmail: string}) {
              const homeString: string = 'Home';
              const [date, setDate] = useState<Date>(new Date());
              return (<View id='HistoryScreen' style={[styles.flex, styles.backgroundColor]}>
        <HistoryComponent userEmail={userEmail} />
    </View>);
}

async function GetBudgetTitle(userEmail: string){
  return storage.getString(accountStorageKey(title_key, userEmail)) || '';
}

async function ClearBudgetTitle(userEmail: string){
  return storage.remove(accountStorageKey(title_key, userEmail));
}

async function GetBudgetHistoryItemsFromStorage(userEmail: string){
  const historyItemPrefix = accountHistoryPrefix(userEmail);
  const allKeys = storage.getAllKeys();
  const historyKeys = allKeys.filter(key => key.startsWith(historyItemPrefix));
  return historyKeys.map(item => {
    const value = storage.getString(item);
    const parsed = value ? JSON.parse(value) : {};
    return {
      id: item,
      budgetId: parsed.budgetId || item.substring(historyItemPrefix.length),
      budgetName: parsed.budgetName || 'Budget history',
      items: Array.isArray(parsed) ? parsed : (parsed.items || []),
    };
  });
}


async function GetBudgetItems(userEmail: string): Promise<BudgetData[]> {
  try{
    let budgetItem = storage.getString(accountStorageKey(budget_items_key, userEmail))
      if (budgetItem){
        return JSON.parse(budgetItem) as BudgetData[];
      }
      else {
        return [];
      }
  } catch(error){
    console.log(error)
    return [];
  }
}

async function GetBudget(userEmail: string): Promise<Budget | null> {
  try {
    const storedBudget = storage.getString(accountStorageKey(budget_key, userEmail));
    if (storedBudget) {
      return JSON.parse(storedBudget) as Budget;
    }

    const localBudgets = GetLocalBudgets(userEmail);
    if (localBudgets.length > 0) {
      const firstBudget = localBudgets[0];
      storage.set(accountStorageKey(budget_key, userEmail), JSON.stringify(firstBudget));
      storage.set(accountStorageKey(budget_items_key, userEmail), JSON.stringify(firstBudget.budgetItems));
      storage.set(accountStorageKey(title_key, userEmail), firstBudget.name);
      return firstBudget;
    }

    const [items, name] = await Promise.all([GetBudgetItems(userEmail), GetBudgetTitle(userEmail)]);
    return {
      budgetId: UUID(),
      name,
      ownerEmail: userEmail,
      budgetItems: items,
    };
  } catch (error) {
    console.error('Failed to load budget', error);
    return null;
  }
}

function GetLocalBudgets(userEmail: string): Budget[] {
  try {
    const storedBudgets = storage.getString(accountStorageKey(budgets_key, userEmail));
    if (storedBudgets) {
      const parsed = JSON.parse(storedBudgets);
      if (Array.isArray(parsed)) return parsed as Budget[];
    }

    const normalizedEmail = userEmail.trim().toLowerCase();
    const legacyBudgets = storage.getString(budgets_key);
    const parsedLegacyBudgets = legacyBudgets ? JSON.parse(legacyBudgets) : [];
    const ownedLegacyBudgets: Budget[] = Array.isArray(parsedLegacyBudgets)
      ? parsedLegacyBudgets.filter(
          (budget: Budget) => budget.ownerEmail?.trim().toLowerCase() === normalizedEmail,
        )
      : [];
    const legacyBudget = storage.getString(budget_key);
    if (legacyBudget) {
      const budget = JSON.parse(legacyBudget) as Budget;
      if (
        budget.ownerEmail?.trim().toLowerCase() === normalizedEmail &&
        !ownedLegacyBudgets.some((item) => item.budgetId === budget.budgetId)
      ) {
        ownedLegacyBudgets.push(budget);
      }
    }
    if (ownedLegacyBudgets.length > 0) SaveLocalBudgets(ownedLegacyBudgets, userEmail);
    return ownedLegacyBudgets;
  } catch (error) {
    console.error('Failed to load local budgets', error);
  }
  return [];
}

function SaveLocalBudgets(budgets: Budget[], userEmail: string): void {
  storage.set(accountStorageKey(budgets_key, userEmail), JSON.stringify(budgets));
}

function UpsertLocalBudget(budget: Budget, userEmail: string): Budget[] {
  const budgets = GetLocalBudgets(userEmail);
  const index = budgets.findIndex((item) => item.budgetId === budget.budgetId);
  if (index >= 0) {
    budgets[index] = budget;
  } else {
    budgets.unshift(budget);
  }
  SaveLocalBudgets(budgets, userEmail);
  return budgets;
}

async function SaveBudget(budget: Budget, userEmail: string): Promise<void> {
  UpsertLocalBudget(budget, userEmail);
  storage.set(accountStorageKey(budget_key, userEmail), JSON.stringify(budget));
  storage.set(accountStorageKey(budget_items_key, userEmail), JSON.stringify(budget.budgetItems));
  storage.set(accountStorageKey(title_key, userEmail), budget.name);

  try {
    const response = await fetch(`${apiUrl}/budgets`, {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({
        budgetId: budget.budgetId,
        name: budget.name,
        budgetItems: budget.budgetItems,
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Unable to save budget');
    }

  } catch (error) {
    console.error('Failed to save budget to server', error);
  }
}

function BudgetSwitcher({
  budgets,
  activeBudgetId,
  onSelect,
  onRefresh,
  onCreate,
}: {
  budgets: Budget[];
  activeBudgetId: string;
  onSelect: (budget: Budget) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onCreate: (name: string) => void | Promise<void>;
}) {
  const [visible, setVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingBudget, setIsCreatingBudget] = useState(false);
  const [switchingBudgetId, setSwitchingBudgetId] = useState<string | null>(null);

  const refreshBudgets = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const selectBudget = async (budget: Budget) => {
    setSwitchingBudgetId(budget.budgetId);
    try {
      await onSelect(budget);
      setVisible(false);
    } finally {
      setSwitchingBudgetId(null);
    }
  };

  return (
    <View>
      <Pressable
        style={[styles.rowPadding, styles.rowBorder, styles.menuButton]}
        onPress={() => {
          setVisible(true);
          void refreshBudgets();
        }}
      >
        {isRefreshing ? <ActivityIndicator size="small" /> : <Text style={[styles.customFont, styles.boldText]}>Switch Budget</Text>}
      </Pressable>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Choose a budget</Text>
            <Pressable
              style={[styles.rowPadding, styles.createBudgetButton]}
              onPress={() => setIsCreating(true)}
            >
              <Text style={styles.createBudgetText}>+ Create new budget</Text>
            </Pressable>
            {isCreating && (
              <View style={styles.createBudgetForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Budget name"
                  placeholderTextColor="#9CA3AF"
                  value={newBudgetName}
                  onChangeText={setNewBudgetName}
                  autoFocus
                />
                <Pressable
                  style={styles.loginButton}
                  onPress={async () => {
                    const name = newBudgetName.trim();
                    if (!name) {
                      Alert.alert('Missing name', 'Enter a name for the new budget.');
                      return;
                    }
                    setIsCreatingBudget(true);
                    try {
                      await onCreate(name);
                      setNewBudgetName('');
                      setIsCreating(false);
                      setVisible(false);
                    } finally {
                      setIsCreatingBudget(false);
                    }
                  }}
                  disabled={isCreatingBudget}
                >
                  {isCreatingBudget ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Create budget</Text>}
                </Pressable>
              </View>
            )}
            {isRefreshing ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Loading budgets...</Text>
              </View>
            ) : budgets.length === 0 ? <Text>No budgets available yet.</Text> : null}
            {!isRefreshing && budgets.map((budget) => (
              <Pressable
                key={budget.budgetId}
                style={[
                  styles.rowPadding,
                  styles.rowBorder,
                  budget.budgetId === activeBudgetId && styles.activeBudgetOption,
                ]}
                onPress={() => selectBudget(budget)}
                disabled={switchingBudgetId !== null}
              >
                {switchingBudgetId === budget.budgetId ? (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator size="small" />
                    <Text style={styles.customFont}>Opening budget...</Text>
                  </View>
                ) : <Text style={styles.customFont}>{budget.name}</Text>}
                <Text style={styles.budgetIdText}>{budget.budgetId}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.rowPadding} onPress={() => setVisible(false)}>
              <Text style={styles.forgotText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

async function SaveBudgetItems(budgetItems: BudgetData[], userEmail: string){
  try {
    const budgetItemsResponse = JSON.stringify(budgetItems)
    storage.set(accountStorageKey(budget_items_key, userEmail), budgetItemsResponse)
  } catch (error) {
    console.log(error)
  }
}

async function SaveBudgetItemToHistoryPage(budget: Budget): Promise<boolean> {
  try {
    const saveResponse = await fetch(`${apiUrl}/budgets`, {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({
        budgetId: budget.budgetId,
        name: budget.name,
        budgetItems: budget.budgetItems,
      }),
    });
    const saveResult = await saveResponse.json();
    if (!saveResponse.ok) {
      throw new Error(saveResult.error || 'Unable to save the current budget.');
    }

    const historyId = UUID();
    const historyResponse = await fetch(`${apiUrl}/history`, {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({
        historyId,
        budgetId: budget.budgetId,
        budgetName: budget.name,
        budgetItems: budget.budgetItems,
      }),
    });
    const historyResult = await historyResponse.json();
    if (!historyResponse.ok) {
      throw new Error(historyResult.error || 'Unable to archive the current budget.');
    }

    storage.set(`${accountHistoryPrefix(budget.ownerEmail)}${historyId}`, JSON.stringify({
      budgetId: budget.budgetId,
      budgetName: budget.name,
      items: budget.budgetItems,
    }));
    return true;
  } catch (error) {
    console.error(error);
    Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save budget history.');
    return false;
  }
}

async function SaveTransactionItem(newTransaction: TransactionData, userEmail: string): Promise<boolean> {
  try {
    const scopedTransactionKey = accountStorageKey(transaction_items_key, userEmail);
    const currentTransactions = await storage.getString(scopedTransactionKey)
    let transactions: TransactionData[] = [];
    if (currentTransactions){
      transactions = (JSON.parse(currentTransactions) as Partial<TransactionData>[]).map(
        (transaction) => ({
          ...transaction,
          userEmail: transaction.userEmail || 'Unknown user',
        } as TransactionData),
      );
    }
    // Assuming newTransaction is the transaction you want to add
    transactions.push(newTransaction);
    await storage.set(scopedTransactionKey, JSON.stringify(transactions));
    return true;
  } catch (error) {
    console.error(error);
    Alert.alert("Error", "Failed to save transaction item.");
    return false;
  }
}

async function ClearTransactionData(userEmail: string){
  try {
    storage.remove(accountStorageKey(transaction_items_key, userEmail));
    return true;
  } catch (error) {
    console.error(error);
    Alert.alert("Error", "Failed to clear transaction data.");
    return false;
  }
}

function BudgetHeader( {budgetAmountRemaining, budgetedTotal, currentBudgetTitle, getTitleFunction, onTitleChange, userEmail}: 
  {budgetAmountRemaining?: number, budgetedTotal?: number, currentBudgetTitle: string, getTitleFunction?: () => void, onTitleChange?: (title: string, previousTitle: string) => void, userEmail: string}){
  const [totalSetBudgetAmount, setTotalBudgetAmount] = useState(totalIncomeAmount);
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [savedTitle, setSavedTitle] = useState<string>(currentBudgetTitle);
  const [potentialSurplus, setPotentialSurplus] = useState(totalSetBudgetAmount - (budgetedTotal ? budgetedTotal : 0));

  const updateBudgetTitle = (text: string) => {
    storage.set(accountStorageKey(title_key, userEmail), text)
  }

  useEffect(() => {
      setSavedTitle(currentBudgetTitle)
    }
      , [currentBudgetTitle])

    return (
        <View style={[styles.container, styles.tableHeaderPadding]}>
        <TextInput
        style={[styles.customFont, styles.headerFontSize, {textAlign: 'center'}]}
        value={savedTitle}
        placeholder="Click to Update Title"
        onChangeText={(text) => {
          setSavedTitle(text);
        }}
        onSubmitEditing={() => {
          const previousTitle = currentBudgetTitle;
          updateBudgetTitle(savedTitle)
          setSavedTitle(savedTitle)
          onTitleChange && onTitleChange(savedTitle, previousTitle)
          getTitleFunction && getTitleFunction()
        }
      }
        />
        <Text style={[styles.customFont, styles.headerFontSize]}>{todaysDate.toDateString()}</Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Total Income: $
            <TextInput
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
        />
        </Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Budget Total: $ {budgetedTotal?.toFixed(2)}</Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Remaining: $ {budgetAmountRemaining?.toFixed(2)}</Text>
        <View style={[styles.row, styles.center]}>
        <Text style={[styles.customFont, styles.headerFontSize
        ]}>Surplus: $ </Text><Text style={[styles.flexEnd, styles.headerFontSize, {color: potentialSurplus >= 0 ? 'green' : 'red'}]}>{potentialSurplus.toFixed(2)}</Text>
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
    <Text style={[styles.boldText, styles.rowContent, styles.customFont]}>Add</Text>
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
  const [showEditDate, setShowEditDate]  = useState<boolean>(false);
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
            {Platform.OS === "android" && (
              <View>
                <Pressable onPress={() => setShowEditDate(!showEditDate)}>
                  <Text>Edit Date</Text>
                  <Text>{budgetSetDate.toLocaleDateString()}</Text>
                </Pressable>
                {showEditDate && (<DatePicker
                  value={budgetSetDate}
                  selectedDate={budgetSetDate}
                  onChange={(selectedDate: Date) => {
                    let utcDate = selectedDate.toUTCString();
                    setShowEditDate(!showEditDate);
                    setBudgetSetDate(new Date(utcDate));
                  }}
                />)}
                </View>
                
            )}
          {Platform.OS !== "android" && (<DatePicker
            value={budgetSetDate}
            selectedDate={budgetSetDate}
            onChange={(selectedDate: Date) => {
              let utcDate = selectedDate.toUTCString();
              setBudgetSetDate(new Date(utcDate));
            }}
          />)}
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

type TransactionData = {
  id: string;
  description: string;
  amount: number;
  date: string;
  info: string;
  userEmail: string;
}

function BudgetComponent({navigation, onLogout, userEmail} : {
  navigation: any;
  onLogout: () => void;
  userEmail: string;
}){
  // TODO : Fetch budget data from API or local storage
  let budgetDataItems: BudgetData[] = [], currentBudgetData
  const [budgetData, setBudgetData] = useState<BudgetData[]>(budgetDataItems);
  const [budgetId, setBudgetId] = useState<string>('');
  const [budgetOwnerEmail, setBudgetOwnerEmail] = useState<string>(userEmail);
  const [transactionData, setTransactionData] = useState<TransactionData[]>([]);
  const [budgetTitle, setBudgetTitle] = useState<string>('');
  const [showTransactions, setShowTransactions] = useState<boolean>(false);
  const [showCloseButton, setShowCloseButton] = useState<boolean>(false);
  const [showMenuButtons, setShowMenuButtons] = useState<boolean>(false);
  const [isLoadingBudget, setIsLoadingBudget] = useState(true);

  const budget: Budget = {
    budgetId,
    name: budgetTitle,
    ownerEmail: budgetOwnerEmail,
    budgetItems: budgetData,
  };
  const [availableBudgets, setAvailableBudgets] = useState<Budget[]>([]);

  const getCurrentBudget = async () =>{
      try {
        const localBudgets = GetLocalBudgets(userEmail);
        if (localBudgets.length > 0) {
          setAvailableBudgets(localBudgets);
        }
        const result = await GetBudget(userEmail);
        if (result) {
          setBudgetId(result.budgetId || UUID());
          setBudgetTitle(result.name || '');
          setBudgetOwnerEmail(result.ownerEmail || userEmail);
          setBudgetData(result.budgetItems || []);
        }
      }
      catch (error) {
        console.log(error)
      } finally {
        setIsLoadingBudget(false);
      }
    };

    const loadAvailableBudgets = async () => {
      const localBudgets = GetLocalBudgets(userEmail);
      setAvailableBudgets(localBudgets);
      try {
        const response = await fetch(`${apiUrl}/budgets`, { headers: apiHeaders() });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Unable to load budgets.');
        }
        const mergedBudgets = result.reduce((budgets: Budget[], serverBudget: Budget) => {
          const localBudget = budgets.find((budget) => budget.budgetId === serverBudget.budgetId);
          const mergedBudget = localBudget
            ? {...localBudget, ...serverBudget}
            : serverBudget;
          const existingIndex = budgets.findIndex(
            (budget) => budget.budgetId === serverBudget.budgetId,
          );
          if (existingIndex >= 0) {
            budgets[existingIndex] = mergedBudget;
          } else {
            budgets.push(mergedBudget);
          }
          return budgets;
        }, [...localBudgets]);
        SaveLocalBudgets(mergedBudgets, userEmail);
        setAvailableBudgets(mergedBudgets);
      } catch (error) {
        if (localBudgets.length === 0) {
          Alert.alert(
            'Unable to load budgets',
            error instanceof Error ? error.message : 'Please try again later.',
          );
        }
      }
    };

    const switchBudget = async (selectedBudget: Budget) => {
      try {
        const response = await fetch(
          `${apiUrl}/budgets/${encodeURIComponent(selectedBudget.budgetId)}`,
          { headers: apiHeaders() },
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Unable to switch budgets.');
        }
        await ClearTransactionData(userEmail);
        setTransactionData([]);
        setBudgetId(result.budgetId);
        setBudgetTitle(result.name);
        setBudgetOwnerEmail(result.ownerEmail || userEmail);
        setBudgetData(result.budgetItems || []);
      } catch (error) {
        const localBudget = GetLocalBudgets(userEmail).find(
          (budget) => budget.budgetId === selectedBudget.budgetId,
        );
        if (localBudget) {
          await ClearTransactionData(userEmail);
          setTransactionData([]);
          setBudgetId(localBudget.budgetId);
          setBudgetTitle(localBudget.name);
          setBudgetOwnerEmail(localBudget.ownerEmail || userEmail);
          setBudgetData(localBudget.budgetItems || []);
          return;
        }
        Alert.alert(
          'Unable to switch budget',
          error instanceof Error ? error.message : 'Please try again later.',
        );
      }
    };

    const loadAcceptedBudget = async (invitation: {budgetId: string}) => {
      const response = await fetch(
        `${apiUrl}/budgets/${encodeURIComponent(invitation.budgetId)}`,
        { headers: apiHeaders() },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to load the shared budget.');
      }

      await ClearTransactionData(userEmail);
      setTransactionData([]);
      setBudgetId(result.budgetId);
      setBudgetTitle(result.name);
      setBudgetOwnerEmail(result.ownerEmail || userEmail);
      setBudgetData(result.budgetItems || []);
      UpsertLocalBudget(result, userEmail);
      await loadAvailableBudgets();
      setShowMenuButtons(false);
    };

    const createBudget = async (name: string) => {
      const newBudget: Budget = {
        budgetId: UUID(),
        name,
        ownerEmail: userEmail,
        budgetItems: [],
      };
      setBudgetId(newBudget.budgetId);
      setBudgetOwnerEmail(newBudget.ownerEmail);
      setBudgetTitle(newBudget.name);
      setBudgetData(newBudget.budgetItems);
      setTransactionData([]);
      await SaveBudget(newBudget, userEmail);
      setAvailableBudgets((currentBudgets) => [newBudget, ...currentBudgets]);
      UpsertLocalBudget(newBudget, userEmail);
    };

  const getCurrentTransactions = async () => {
    try {
      const result = storage.getString(accountStorageKey(transaction_items_key, userEmail))
      if (result){
        setTransactionData(
          (JSON.parse(result) as Partial<TransactionData>[]).map((transaction) => ({
            ...transaction,
            userEmail: transaction.userEmail || 'Unknown user',
          } as TransactionData)),
        )
      }
    }
    catch (error) {
      console.log(error)
    }
  }

  const clearCurrentTransactions = async () => {
    try {
      await ClearTransactionData(userEmail);
      setTransactionData([]);
    }
    catch (error) {
      console.log(error)
    }
  }
  
  const saveCurrentTransaction = async (newTransaction: TransactionData) => {
    try {
      await SaveTransactionItem(newTransaction, userEmail);
      getCurrentTransactions();
    } catch (error) {
      console.log(error)
    }
  }

  const recordBudgetTitleChange = (newTitle: string, previousTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle || trimmedTitle === previousTitle.trim()) return;
    saveCurrentTransaction({
      id: `updateBudgetTitle${Date.now()}`,
      description: 'Budget title updated',
      amount: 0,
      date: new Date().toISOString(),
      info: `Budget title changed from "${previousTitle}" to "${trimmedTitle}".`,
      userEmail,
    });
  }
  const getTitle = async () => {
      try{
        const result = await GetBudgetTitle(userEmail)
        if (result) setBudgetTitle(result)
      }
      catch (error){
        console.log(error)
      }
    };

  useEffect(() => {
    getCurrentBudget();
    getCurrentTransactions();
    getTitle();
    void loadAvailableBudgets();
  }, []);

  useEffect(() => {
    if (!budgetId || !budgetTitle.trim()) return;
    void SaveBudget(budget, userEmail);
  }, [budgetId, budgetTitle, budgetData, userEmail]);

  useEffect(() => {
    function checkIfShowCloseButton(){
    if (
      budgetData.length > 0 &&
      budgetTitle.trim().length > 0 &&
      budgetOwnerEmail.toLowerCase() === userEmail.toLowerCase()
    ) {
      setShowCloseButton(true);
    }
    else {
      setShowCloseButton(false);
    }
  } 
  checkIfShowCloseButton();
}, [budgetTitle, budgetData, budgetOwnerEmail, userEmail])

  const clearBudgetItems = () => {
    const emptyBudgetData: BudgetData[] = budgetData.map(item => {
      const itemDate = new Date(item.date);
      const oneMonthLater = new Date(itemDate.setMonth(itemDate.getMonth() + 1));
      return {...item, amount: 0, date: oneMonthLater.toISOString().split('T')[0]};
    });
    SaveBudgetItems(emptyBudgetData, userEmail);
    setBudgetData(emptyBudgetData);
    setBudgetId(UUID());
    setBudgetTitle('');
    Alert.alert("Budget Closed", "Your current budget has been closed to history and a new one has been created.")
    
  }
  const updateBudgetAmountUsed = (id: string, newAmount: number) => {
      const updatedItem = budgetData.map(item => {
          if(item.id === id){
              return {...item, amount: newAmount + item.amount};
          }
          return item;
      });
      saveCurrentTransaction({
        id: `updateAmount${Date.now()}`,
        description: `${updatedItem.find(item => item.id === id)?.description} amount updated`,
        amount: newAmount,
        date: new Date().toISOString(),
        info: `"${updatedItem.find(item => item.id === id)?.description}" amount updated by $${newAmount}.`,
        userEmail,
      })
      setBudgetData(updatedItem);
      SaveBudgetItems(updatedItem, userEmail);
  };

  const updateBudgetAmount = (id: string, newAmount: number) => {
    const updatedItem = budgetData.map(item => {
          if(item.id === id){
              return {...item, budget: newAmount};
          }
          return item;
      });
      saveCurrentTransaction({
        id: `adjustBudgetAmount${Date.now()}`,
        description: `${updatedItem.find(item => item.id === id)?.description} budget amount updated`,
        amount: 0,
        date: new Date().toISOString(),
        info: `"${updatedItem.find(item => item.id === id)?.description}" budget amount updated to $${newAmount}.`,
        userEmail,
      })
      setBudgetData(updatedItem);
      SaveBudgetItems(updatedItem, userEmail);
  };

  const updateBudgetDescription = (id: string, newDescription: string) =>{
    const oldDescription = budgetData.find(item => item.id === id)?.description;
    const updatedItem = budgetData.map(item => {
      if (item.id === id){
        return {...item, description: newDescription};
      }
      return item;
    });
    saveCurrentTransaction({
      id: `updateDescription${Date.now()}`,
      description: `${updatedItem.find(item => item.id === id)?.description} description updated`,
      amount: 0,
      date: new Date().toISOString(),
      info: `"${oldDescription}" description updated to "${newDescription}".`,
      userEmail,
    })
    setBudgetData(updatedItem);
    SaveBudgetItems(updatedItem, userEmail);
  };
  
const updateBudgetDueDate = (id: string, newDate: Date) => {
  const updatedItem = budgetData.map(item => {
    if (item.id === id){
      return {...item, date: newDate.toISOString().split('T')[0]};
    }
    return item;
  });
  saveCurrentTransaction({
    id: `updateDate${Date.now()}`,
    description: `${updatedItem.find(item => item.id === id)?.description} due date updated`,
    amount: 0,
    date: new Date().toISOString(),
    info: `"${updatedItem.find(item => item.id === id)?.description}" due date updated to ${newDate.toISOString().split('T')[0]}.`,
    userEmail,
  })
  setBudgetData(updatedItem);
  SaveBudgetItems(updatedItem, userEmail);
}

const removeBudgetItem = (id: string) => {
  const removedItem = budgetData.find(item => item.id === id);
      saveCurrentTransaction({
      id: `remove${Date.now()}`,
      description: `${removedItem?.description}`,
      amount: Number(removedItem?.budget),
      date: new Date().toISOString(),
      info: `"${removedItem?.description}" amount $${removedItem?.budget} removed.`,
      userEmail,
    })
  const updatedBudget = budgetData.filter(item => item.id !== id)
  setBudgetData(updatedBudget);
  SaveBudgetItems(updatedBudget, userEmail);
};



const addBudgetItem = (budgetItem: BudgetData) =>{
  const largestExistingId = budgetData.reduce((maxId, item) => Math.max(maxId, parseInt(item.id)), 0);
    const itemWithId = { ...budgetItem, id: (largestExistingId + 1).toString() };
              let budgetDataWithAddedItem = budgetData.concat(itemWithId)
              saveCurrentTransaction({
                id: `${Date.now()}`,
                description: `${budgetItem.description}`,
                amount: budgetItem.budget,
                date: new Date().toISOString(),
                info: `"${budgetItem.description}" amount $${budgetItem.budget} added.`,
                userEmail,
              })
              setBudgetData(budgetDataWithAddedItem);
              SaveBudgetItems(budgetDataWithAddedItem, userEmail);
}

  totalBudgetAmount = budgetData.reduce((acc, item) => acc + item.budget, 0);
  budgetRemaining = totalBudgetAmount - budgetData.reduce((acc, item) => acc + item.amount, 0);
    return (
            <View style={[styles.flex, styles.backgroundColor]}>  
            <View style={styles.flexStart}>
              <Pressable onPress={() => setShowMenuButtons(!showMenuButtons)}>
                <Text style={[styles.rowPadding, styles.rowBorder, styles.customFont, styles.boldText]}>
                  {showMenuButtons ? 'Close' : 'Menu'}
                  </Text>
              </Pressable>
              {showMenuButtons && (
                <View style={{flexDirection: 'column'}}>
                  <LogOutButton onLogout={onLogout}/>         
                  <HistoryButton navigation={navigation}/>
                  <BudgetSwitcher
                    budgets={availableBudgets}
                    activeBudgetId={budgetId}
                    onRefresh={loadAvailableBudgets}
                    onSelect={switchBudget}
                    onCreate={createBudget}
                  />
                  {budgetOwnerEmail.toLowerCase() === userEmail.toLowerCase() && (
                    <BudgetProvider budgetId={budget.budgetId} budgetName={budget.name}>
                      <BudgetShareComponent budget={budget} />
                    </BudgetProvider>
                  )}
                  <BudgetInvitationComponent email={userEmail} onBudgetAccepted={loadAcceptedBudget} />
                </View>
              )}
            </View>
            <View style={{flex: 1, minHeight: 20, margin: 50}}>
            <BudgetHeader
                budgetAmountRemaining={budgetRemaining}
                budgetedTotal={totalBudgetAmount}
                currentBudgetTitle={budgetTitle}
                getTitleFunction={getTitle}
                onTitleChange={recordBudgetTitleChange}
                userEmail={userEmail}
                />
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
              updateDueDate={(date: Date) => {
                updateBudgetDueDate(item.id, date)
              }}
                  /> }
            keyExtractor={item => item.id}
            numColumns={1}
            //extraData={[budgetData, budgetTitle]}
            ListFooterComponent={<FooterComponent addBudgetItem={(newItem: BudgetData) => {
              addBudgetItem(newItem)
            }} />}
            />
            {
              transactionData.length > 0 && (
                <View style={[styles.rowPadding, styles.rowBorder, styles.center]}>
                  <Pressable onPress={() => setShowTransactions(!showTransactions)}>
                    <Text>Show Transactions</Text>
                  </Pressable>
                  {showTransactions && (
                    <View>
                      {transactionData.map((transaction) => (
                        <View key={transaction.id}>
                          <Text>{transaction.info}</Text>
                                <Text key={`${transaction.id}-user`} style={styles.transactionUser}>
                                  By: {transaction.userEmail}
                                </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            }
            { showCloseButton && (
              <View style={[styles.rowPadding, styles.rowBorder, styles.center]}>
                <Pressable
                  onPress={async () => {
                    const archived = await SaveBudgetItemToHistoryPage(budget);
                    if (!archived) return;
                    const remainingBudgets = GetLocalBudgets(userEmail).filter(
                      (savedBudget) => savedBudget.budgetId !== budget.budgetId,
                    );
                    SaveLocalBudgets(remainingBudgets, userEmail);
                    setAvailableBudgets(remainingBudgets);
                    clearBudgetItems();
                    await clearCurrentTransactions();
                    await loadAvailableBudgets();
                  }}>

                <Text>Close and Move to History</Text>
              </Pressable>
            </View>)}
            {isLoadingBudget && (
              <View style={styles.budgetLoadingOverlay}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Loading your budget...</Text>
              </View>
            )}
      </View>);
}

function HistoryButton({navigation}: {navigation: any}){
    //const navigation = useNavigation();
    return (<View style={[styles.flexStart]}>
            <Pressable onPress={() => navigation.navigate('History')}>
              <Text style={[styles.rowPadding, styles.rowBorder, styles.customFont, styles.boldText]}>Go To History</Text>
            </Pressable>
            </View>);
}

function LogOutButton( {onLogout}: {onLogout: () => void}){
  return (<View style={[styles.flexStart]}>
    <Pressable onPress={onLogout}>
      <Text style={[styles.rowPadding, styles.rowBorder, styles.customFont, styles.boldText]}>Log Out</Text>
    </Pressable>
  </View>);
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
    flexStart:{
      alignItems: 'flex-start'
    },
    flexBetween:{
      justifyContent: 'space-between'
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
  transactionUser: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  tableHeaderPadding:{
    marginTop: 15
  },
  backgroundColor: {
    backgroundColor: '#F0F8FF'
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  modalView: {
    width: '85%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  activeBudgetOption: {
    backgroundColor: '#E0F2FE',
  },
  budgetIdText: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 4,
  },
  createBudgetButton: {
    backgroundColor: '#E0F2FE',
    marginBottom: 10,
  },
  menuButton: {
    alignSelf: 'flex-start',
  },
  createBudgetText: {
    color: '#0369A1',
    fontWeight: '700',
  },
  createBudgetForm: {
    gap: 10,
    marginBottom: 10,
  },

  innerContainer: {
    flex: 1,
    justifyContent: 'space-around',
    paddingHorizontal: 24,
  },
  sessionLoading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  sessionLoadingText: {
    color: '#666666',
    fontSize: 14,
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    color: '#666666',
    fontSize: 13,
  },
  budgetLoadingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(240, 248, 255, 0.92)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  formContainer: {
    marginVertical: 20,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  eyeButton: {
    paddingHorizontal: 16,
  },
  eyeText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  actionContainer: {
    marginBottom: 20,
  },
  loginButton: {
    height: 52,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  backToLoginButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#666666',
  },
  signUpText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  showButton: {
    color: '#2563EB',
    fontWeight: '600',
    padding: 4,
  },
  signUpButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: '#6B7280',
    fontSize: 14,
  },
  loginLink: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
});
export default App;
