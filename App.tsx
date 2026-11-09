import 'react-native-get-random-values';
import React, { useEffect, useRef, useState, createContext } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  TextInput,
  Dimensions,
  useWindowDimensions,
  FlatList,
  useColorScheme,
  StatusBar,
  Alert,
  Pressable,
  Modal,
  Linking,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from "react-native";

import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Wallet02Icon,
  Mail01Icon,
  LockPasswordIcon,
  CheckCheckIcon,
} from '@hugeicons/core-free-icons';

import { storage } from './Helpers/storage';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  validatePassword,
} from './Helpers/PasswordValidator';

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
import { getAcceptedLocalBudget } from './Helpers/localBudgetSharing';
import {v4 as UUID} from 'uuid';
import { apiHeaders, apiUrl, authTokenKey } from './Helpers/api';

declare const window: {
  location: {pathname: string};
  history: {
    pushState: (state: object, unused: string, url: string) => void;
    replaceState: (state: object, unused: string, url: string) => void;
  };
  addEventListener: (type: 'popstate', listener: () => void) => void;
  removeEventListener: (type: 'popstate', listener: () => void) => void;
};

function RightAction({drag, itemId, callDelete}: {
  drag: SharedValue<number>;
  itemId: string;
  callDelete: (deleteId: string) => void;
}) {
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
const isLocalOnlyMode = false;
const DEFAULT_TOTAL_INCOME = 2000;
const budgetSaveRequests = new Map<string, Promise<void>>();

const getLoginTheme = (isDarkMode: boolean) => ({
  background: isDarkMode ? '#08131d' : '#F0F8FF',
  backgroundAlt: isDarkMode ? '#0f1d2b' : '#EAF3FF',
  panel: isDarkMode ? '#102535' : '#FFFFFF',
  border: isDarkMode ? '#244968' : '#D8E8FF',
  primary: isDarkMode ? '#7dd3fc' : '#2563EB',
  primaryDark: isDarkMode ? '#38bdf8' : '#1D4ED8',
  text: isDarkMode ? '#EAF7FF' : '#1A1A1A',
  muted: isDarkMode ? '#A9C3D8' : '#666666',
  inputBackground: isDarkMode ? '#0d1b29' : '#F5F5F5',
  inputText: isDarkMode ? '#EAF7FF' : '#1A1A1A',
  overlay: isDarkMode ? 'rgba(8, 19, 29, 0.82)' : 'rgba(240, 248, 255, 0.92)',
});

function isForgotPasswordRoute(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  const pathname = window.location?.pathname;
  return typeof pathname === 'string' && pathname.replace(/\/+$/, '') === '/forgot-password';
}

function accountStorageKey(key: string, email: string): string {
  return `${key}:${encodeURIComponent(email.trim().toLowerCase())}`;
}

function accountHistoryPrefix(email: string): string {
  return `HI:${encodeURIComponent(email.trim().toLowerCase())}:`;
}

function clearLocalAccountData(email: string): void {
  const scopedKeys = [
    title_key,
    budget_items_key,
    budget_key,
    budgets_key,
    transaction_items_key,
  ].map((key) => accountStorageKey(key, email));
  const historyPrefix = accountHistoryPrefix(email);
  const keysToRemove = storage.getAllKeys().filter(
    (key) => scopedKeys.includes(key) || key.startsWith(historyPrefix),
  );
  keysToRemove.forEach((key) => storage.remove(key));
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

function BrandHeader({isDarkMode}: {isDarkMode: boolean}) {
  const theme = getLoginTheme(isDarkMode);

  return (
    <View style={styles.brandHeader}>
      <View style={[styles.brandBadge, { backgroundColor: theme.primary }]}>
        <HugeiconsIcon icon={Wallet02Icon} size={28} color="#FFFFFF" strokeWidth={1.8} />
      </View>
      <Text style={[styles.brandTitle, { color: theme.text }]}>Budget Buddy</Text>
      <View style={[styles.brandTag, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
        <HugeiconsIcon icon={CheckCheckIcon} size={12} color={theme.primary} strokeWidth={1.8} />
        <Text style={[styles.brandSubtitle, { color: theme.muted }]}>Smarter budgeting for real life</Text>
      </View>
    </View>
  );
}

function SignUpScreen({isActiveToggle, isDarkMode}: {isActiveToggle: () => void; isDarkMode: boolean}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = getLoginTheme(isDarkMode);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Missing information', 'Please enter your email and password.');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Invalid password', passwordError);
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.content, {
        backgroundColor: theme.panel,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 20,
        paddingVertical: 28,
        paddingHorizontal: 20,
        shadowColor: theme.primary,
        shadowOpacity: isDarkMode ? 0.24 : 0.12,
        shadowRadius: 18,
        elevation: 4,
      }]}>
        <BrandHeader isDarkMode={isDarkMode} />

        <Text style={[styles.title, { color: theme.text, fontSize: 28, marginBottom: 8, marginTop: 0 }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: theme.muted, marginBottom: 20, fontSize: 14 }]}>
          Sign up to get started with your account.
        </Text>

        <View style={styles.fieldLabelRow}>
          <HugeiconsIcon icon={Mail01Icon} size={16} color={theme.primary} strokeWidth={1.8} />
          <Text style={[styles.label, { color: theme.text }]}>Email</Text>
        </View>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.inputBackground,
            borderColor: theme.border,
            color: theme.inputText,
          }]}
          placeholder="you@example.com"
          placeholderTextColor={theme.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          accessibilityLabel="Email address"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.fieldLabelRow}>
          <HugeiconsIcon icon={LockPasswordIcon} size={16} color={theme.primary} strokeWidth={1.8} />
          <Text style={[styles.label, { color: theme.text }]}>Password</Text>
        </View>
        <View style={[styles.passwordContainer, {
          backgroundColor: theme.inputBackground,
          borderColor: theme.border,
        }]}>
          <TextInput
            style={[styles.passwordInput, { color: theme.inputText }]}
            placeholder="Create a strong password"
            placeholderTextColor={theme.muted}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel="New password"
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={[styles.showButton, { color: theme.primary }]}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.passwordHint, { color: theme.muted }]}>{PASSWORD_REQUIREMENTS}</Text>

        <TouchableOpacity
          style={[styles.signUpButton, { backgroundColor: theme.primary }]}
          onPress={handleSignUp}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.signUpText}>Sign up</Text>}
        </TouchableOpacity>

        <View style={styles.loginContainer}>
          <Text style={[styles.loginText, { color: theme.muted }]}>Already have an account? </Text>
          <TouchableOpacity onPress={isActiveToggle}>
            <Text style={[styles.loginLink, { color: theme.primary }]}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ForgotPasswordScreen({onBack, isDarkMode}: {onBack: () => void; isDarkMode: boolean}) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = getLoginTheme(isDarkMode);

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
      style={[styles.innerContainer, { backgroundColor: theme.background }]}
    >
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { color: theme.text }]}>Reset password</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Enter your email and we&apos;ll send you a reset link.</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputWrapper}>
          <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
              color: theme.inputText,
            }]}
            placeholder="Enter your email"
            placeholderTextColor={theme.muted}
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
          style={[styles.loginButton, { backgroundColor: theme.primary }, isSubmitting && styles.disabledButton]}
          onPress={handleForgotPassword}
          disabled={isSubmitting}
        >
          {isSubmitting && <ActivityIndicator color="#FFFFFF" />}
          <Text style={styles.loginButtonText}>{isSubmitting ? 'Sending...' : 'Send reset link'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backToLoginButton} onPress={onBack}>
          <Text style={[styles.forgotText, { color: theme.primary }]}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function ResetPasswordScreen({
  email,
  token,
  onComplete,
  isDarkMode,
}: {
  email: string;
  token: string;
  onComplete: () => void;
  isDarkMode: boolean;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = getLoginTheme(isDarkMode);

  const handleResetPassword = async () => {
    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Invalid password', passwordError);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please enter the same password twice.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/reset-password`, {
        method: 'POST',
        headers: apiHeaders(true),
        body: JSON.stringify({email, token, password}),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to reset your password.');
      }

      Alert.alert('Password updated', 'You can now log in with your new password.', [
        {text: 'Back to login', onPress: onComplete},
      ]);
    } catch (error) {
      Alert.alert(
        'Unable to reset password',
        error instanceof Error ? error.message : 'Please try again later.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.innerContainer, { backgroundColor: theme.background }]}
    >
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { color: theme.text }]}>Choose a new password</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Enter and confirm a password for {email}.</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputWrapper}>
          <Text style={[styles.label, { color: theme.text }]}>New password</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
              color: theme.inputText,
            }]}
            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
            placeholderTextColor={theme.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
          />
          <Text style={[styles.passwordHint, { color: theme.muted }]}>{PASSWORD_REQUIREMENTS}</Text>
        </View>
        <View style={styles.inputWrapper}>
          <Text style={[styles.label, { color: theme.text }]}>Confirm password</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
              color: theme.inputText,
            }]}
            placeholder="Re-enter your new password"
            placeholderTextColor={theme.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.loginButton, { backgroundColor: theme.primary }, isSubmitting && styles.disabledButton]}
          onPress={handleResetPassword}
          disabled={isSubmitting}
        >
          {isSubmitting && <ActivityIndicator color="#FFFFFF" />}
          <Text style={styles.loginButtonText}>{isSubmitting ? 'Updating...' : 'Update password'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function LoginScreen({ authorized, isDarkMode }: { authorized: (token: string, email: string) => Promise<void>; isDarkMode: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [signUpScreenActive, setSignUpScreenActive] = useState(false);
  const [forgotPasswordScreenActive, setForgotPasswordScreenActive] = useState(isForgotPasswordRoute);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = getLoginTheme(isDarkMode);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (typeof window.addEventListener !== 'function') return;

    const handlePopState = () => {
      setForgotPasswordScreenActive(isForgotPasswordRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openForgotPassword = () => {
    setForgotPasswordScreenActive(true);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/forgot-password');
    }
  };

  const closeForgotPassword = () => {
    setForgotPasswordScreenActive(false);
    if (isForgotPasswordRoute() && typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', '/');
    }
  };

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      { !signUpScreenActive && !forgotPasswordScreenActive &&
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.innerContainer, { backgroundColor: theme.background }]}
      >
        <View style={styles.headerContainer}>
          <BrandHeader isDarkMode={isDarkMode} />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputWrapper}>
            <View style={styles.fieldLabelRow}>
              <HugeiconsIcon icon={Mail01Icon} size={16} color={theme.primary} strokeWidth={1.8} />
              <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
            </View>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.inputText,
              }]}
              placeholder="Enter your email"
              placeholderTextColor={theme.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputWrapper}>
            <View style={styles.fieldLabelRow}>
              <HugeiconsIcon icon={LockPasswordIcon} size={16} color={theme.primary} strokeWidth={1.8} />
              <Text style={[styles.label, { color: theme.text }]}>Password</Text>
            </View>
            <View style={[styles.passwordContainer, {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
            }]}>
              <TextInput
                style={[styles.passwordInput, { color: theme.inputText }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.muted}
                secureTextEntry={secureTextEntry}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                accessibilityLabel="Password"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setSecureTextEntry(!secureTextEntry)} style={styles.eyeButton}>
                <Text style={[styles.eyeText, { color: theme.primary }]}>{secureTextEntry ? 'Show' : 'Hide'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotPassword} onPress={openForgotPassword}>
            <Text style={[styles.forgotText, { color: theme.primary }]}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.primary }, isSubmitting && styles.disabledButton]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Log In</Text>}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: theme.muted }]}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => setSignUpScreenActive(true)}>
              <Text style={[styles.signUpText, { color: theme.primary }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>}
      {signUpScreenActive && <SignUpScreen isActiveToggle={() => setSignUpScreenActive(false)} isDarkMode={isDarkMode} />}
      {forgotPasswordScreenActive && (
        <ForgotPasswordScreen onBack={closeForgotPassword} isDarkMode={isDarkMode} />
      )}
    </SafeAreaView>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [passwordResetLink, setPasswordResetLink] = useState<{email: string; token: string} | null>(null);

  useEffect(() => {
    const applyResetLink = (url: string | null) => {
      if (!url) return;
      try {
        const queryStart = url.indexOf('?');
        if (queryStart < 0) return;
        let token = '';
        let resetEmail = '';
        const query = url.slice(queryStart + 1).split('#')[0];
        for (const parameter of query.split('&')) {
          const separatorIndex = parameter.indexOf('=');
          const key = decodeURIComponent(
            (separatorIndex < 0 ? parameter : parameter.slice(0, separatorIndex)).replace(/\+/g, ' '),
          );
          const value = decodeURIComponent(
            (separatorIndex < 0 ? '' : parameter.slice(separatorIndex + 1)).replace(/\+/g, ' '),
          );
          if (key === 'token') token = value;
          if (key === 'email') resetEmail = value;
        }
        if (token && resetEmail) {
          setPasswordResetLink({email: resetEmail, token});
        }
      } catch (error) {
        console.error('Unable to read password reset link', error);
      }
    };

    void Linking.getInitialURL().then(applyResetLink).catch((error: unknown) => {
      console.error('Unable to read initial app link', error);
    });
    const subscription = Linking.addEventListener('url', ({url}) => applyResetLink(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isLocalOnlyMode) return;

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
        {passwordResetLink ? (
          <ResetPasswordScreen
            email={passwordResetLink.email}
            token={passwordResetLink.token}
            onComplete={() => setPasswordResetLink(null)}
            isDarkMode={isDarkMode}
          />
        ) : (
          <>
        { !isAuthenticated && isRestoringSession && (
          <View style={[styles.sessionLoading, { backgroundColor: isDarkMode ? '#08131d' : '#F0F8FF' }]}> 
            <ActivityIndicator size="large" />
            <Text style={[styles.sessionLoadingText, { color: isDarkMode ? '#A9C3D8' : '#666666' }]}>Restoring your session...</Text>
          </View>
        )}
        { !isAuthenticated && !isRestoringSession && <LoginScreen authorized={handleAuthenticated} isDarkMode={isDarkMode} /> }
       { isAuthenticated && (
         <RootStack
           userEmail={userEmail}
           logout={handleLogout}
         />
       )}
          </>
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
  totalIncome: number;
  pendingSync?: boolean;
}

type BudgetType = 'fixed' | 'variable';

type BudgetData = {
    id: string;
    description: string;
    budget: number;
    amount: number;
    date: string;
    budgetType: BudgetType;
    onDeleteConfirm?: (id: string) => void;
    addAmount?: (amount: number) => void;
    adjustBudgetAmount?: (amount: number) => void;
    updateBudgetDescription?: (description: string) => void;
    updateBudgetType?: (budgetType: BudgetType) => void;
    updateDueDate?: (date: Date) => void;
};

function normalizeCurrencyAmount(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function sumBudgetAmounts(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return normalizeCurrencyAmount(items.reduce((total: number, item: unknown) => {
    if (!item || typeof item !== 'object') return total;
    return total + normalizeCurrencyAmount((item as {budget?: unknown}).budget);
  }, 0));
}

function sumVariableBudgetSavings(items: BudgetData[]): number {
  return normalizeCurrencyAmount(items.reduce(
    (total, item) => total + (
      item.budgetType === 'variable' ? Math.max(item.budget - item.amount, 0) : 0
    ),
    0,
  ));
}

function normalizeBudgetIncome(value: unknown): number {
  if (value === null || value === undefined || value === '') return DEFAULT_TOTAL_INCOME;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : DEFAULT_TOTAL_INCOME;
}

function normalizeBudgetItems(value: unknown): BudgetData[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const budgetItem = item && typeof item === 'object'
      ? item as Partial<BudgetData>
      : {};
    const date = typeof budgetItem.date === 'string' ? new Date(budgetItem.date) : new Date();

    return {
      id: typeof budgetItem.id === 'string' && budgetItem.id
        ? budgetItem.id
        : String(index + 1),
      description: typeof budgetItem.description === 'string' ? budgetItem.description : '',
      budget: normalizeCurrencyAmount(budgetItem.budget),
      amount: normalizeCurrencyAmount(budgetItem.amount),
      date: Number.isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0],
      budgetType: budgetItem.budgetType === 'variable' ? 'variable' : 'fixed',
    };
  });
}

type HistoryItemList = {
  id: string;
  budgetId: string;
  budgetName: string;
  totalBudget: number;
  items: HistoryItemModel[];
}
type HistoryItemModel = {
  id: string;
  description: string;
  budget: number;
  amount: number;
  date: string;
  budgetType?: BudgetType;
}
type RootStackParamList = {
  'Budget Buddy': any,
  History: any
}

const HistoryItem = ({description, budget, amount, date, budgetType}: HistoryItemModel) => {
  const {width} = useWindowDimensions();
  const isCompact = width < 600;

  const budgetField = (
    <View style={isCompact ? styles.mobileBudgetField : styles.flex}>
      {isCompact && <Text style={styles.mobileBudgetLabel}>Budget</Text>}
      <Text style={styles.customFont}>{budget.toFixed(2)}</Text>
    </View>
  );
  const paidField = (
    <View style={[
      styles.flex,
      styles.categoryDescription,
      isCompact ? styles.mobileBudgetField : null,
    ]}>
      {isCompact && <Text style={styles.mobileBudgetLabel}>Paid</Text>}
      <Text style={[styles.customFont, amount > budget ? styles.overBudgetAmount : null]}>
        {amount.toFixed(2)}
      </Text>
      {budgetType === 'variable' && budget > amount && (
        <Text style={[styles.customFont, styles.savingsText]}>
          {normalizeCurrencyAmount(budget - amount).toFixed(2)}
        </Text>
      )}
    </View>
  );
  const dueDateField = (
    <View style={isCompact ? styles.mobileBudgetField : styles.flex}>
      {isCompact && <Text style={styles.mobileBudgetLabel}>Due date</Text>}
      <Text style={styles.customFont}>
        {new Date(date)?.toISOString().split('T')[0].replace('/', '-').substring(5) ?? new Date()}
      </Text>
    </View>
  );

  return (
    <View style={[
      styles.rowContainer,
      styles.rowPadding,
      styles.rowBorder,
      styles.flex,
      isCompact ? styles.mobileBudgetContainer : null,
    ]}>
      <View style={[
        styles.flex,
        styles.categoryDescription,
        isCompact ? styles.mobileBudgetDescription : null,
      ]}>
        <Text style={styles.customFont}>{description}</Text>
        <Text style={[styles.customFont, styles.categoryType]}>
          {budgetType === 'variable' ? 'Variable' : 'Fixed'}
        </Text>
      </View>
      {isCompact ? (
        <View style={styles.mobileBudgetFields}>
          {budgetField}
          {paidField}
          {dueDateField}
        </View>
      ) : (
        <>
          {budgetField}
          {paidField}
          {dueDateField}
        </>
      )}
    </View>
  );
}

const todaysDate = new Date();
let budgetRemaining = Number(0);
let totalBudgetAmount = Number(0);

const BudgetItem = ({id, description, budget, amount, date, budgetType, onDeleteConfirm, addAmount, adjustBudgetAmount, updateBudgetDescription, updateBudgetType, updateDueDate}: BudgetData) => {
  const {width} = useWindowDimensions();
  const isCompact = width < 600;
  const isPaidInFull = budget === amount;
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [amountAdded, setAmountAdded] = useState<string>('');
  const [isAmountInvalid, setIsAmountInvalid] = useState<boolean>(false);
  const [editableBudget, setEditableBudgetAmount] = useState<string>(budget.toFixed(2));
  const lastCommittedBudget = useRef<string | null>(null);
  const [dueDate, setDueDate] = useState<Date>(new Date(date));
  const [isEditingDueDate, setIsEditingDueDate] = useState<boolean>(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState<boolean>(true);
  const [budgetDescription, setBudgetDescription] = useState<string>(description);
  const toggleEdit = () => {
      setIsEditing(!isEditing);
  }
  const callDeleteWithId = (itemId: string) => {
    onDeleteConfirm && onDeleteConfirm(itemId)
  }

  const callAdjustDueDate = (newDate: Date) => {
    updateDueDate && updateDueDate(newDate)
  }

  const submitAddedAmount = () => {
    const normalizedAmount = amountAdded.trim();
    const parsedAmount = Number(normalizedAmount);
    if (
      !normalizedAmount ||
      !Number.isFinite(parsedAmount) ||
      !/^-?\d*\.?\d{0,2}$/.test(normalizedAmount) ||
      amount + parsedAmount < 0
    ) {
      setIsAmountInvalid(true);
      return;
    }

    addAmount && addAmount(normalizeCurrencyAmount(parsedAmount));
    setIsEditing(false);
    setAmountAdded('');
    setIsAmountInvalid(false);
  }

  useEffect(() => {
    setDueDate(new Date(date))
  }, [date])

  useEffect(() => {
    setEditableBudgetAmount(budget.toFixed(2));
  }, [budget]);

  const commitBudgetAmount = () => {
    const normalizedBudget = editableBudget.trim();
    const parsedBudget = Number(normalizedBudget);
    if (
      normalizedBudget &&
      Number.isFinite(parsedBudget) &&
      /^\d*\.?\d{0,2}$/.test(normalizedBudget)
    ) {
      const roundedBudget = normalizeCurrencyAmount(parsedBudget);
      const committedValue = roundedBudget.toFixed(2);
      setEditableBudgetAmount(committedValue);
      if (
        roundedBudget !== budget &&
        lastCommittedBudget.current !== committedValue
      ) {
        lastCommittedBudget.current = committedValue;
        adjustBudgetAmount && adjustBudgetAmount(roundedBudget);
      }
    } else {
      setEditableBudgetAmount(budget.toFixed(2));
    }
  };

  const budgetField = (
    <View style={isCompact ? styles.mobileBudgetField : styles.rowContent}>
      {isCompact && <Text style={styles.mobileBudgetLabel}>Budget</Text>}
      <TextInput
        style={[styles.rowContent, styles.customFont, styles.zeroWidthForPadding]}
        value={editableBudget.toString()}
        placeholder={editableBudget.toString()}
        keyboardType="decimal-pad"
        onChangeText={(text) => {
          lastCommittedBudget.current = null;
          setEditableBudgetAmount(text)
        }}
        onBlur={commitBudgetAmount}
        onSubmitEditing={commitBudgetAmount}
      />
    </View>
  );

  const paidField = (
    <View style={[
      styles.flex,
      styles.center,
      styles.zeroWidthForPadding,
      isCompact ? styles.mobileBudgetField : null,
    ]}>
      {isCompact && <Text style={styles.mobileBudgetLabel}>Paid</Text>}
      <Text style={[styles.customFont, amount > budget ? styles.overBudgetAmount : null]}>
        {amount.toFixed(2)}
      </Text>
      {budgetType === 'variable' && budget > amount && (
        <Text style={[styles.customFont, styles.savingsText]}>
          {normalizeCurrencyAmount(budget - amount).toFixed(2)}
        </Text>
      )}
    </View>
  );

  const dueDateField = (
    <Pressable
      style={[
        styles.rowContent,
        styles.zeroWidthForPadding,
        isCompact ? styles.mobileBudgetField : null,
      ]}
      onLongPress={() => setIsEditingDueDate(true)}
    >
      {isCompact && <Text style={styles.mobileBudgetLabel}>Due date</Text>}
      {isEditingDueDate ? (
        <View style={[styles.rowContent, styles.zeroWidthForPadding]}>
          <DatePicker
            value={dueDate}
            selectedDate={dueDate}
            onChange={(selectedDate: Date) => {
              const utcDate = selectedDate.toUTCString();
              setDueDate(new Date(utcDate));
              callAdjustDueDate(selectedDate);
              setIsEditingDueDate(false);
            }}
          />
        </View>
      ) : (
        <View style={styles.rowContent}>
          <Text style={[styles.rowContent, styles.customFont]}>
            {dueDate?.toISOString().split('T')[0].replace('/', '-').substring(5) ?? new Date().toDateString()}
          </Text>
        </View>
      )}
    </Pressable>
  );

  const addAmountField = (
    <View style={isCompact ? styles.mobileBudgetField : styles.rowContent}>
      {isCompact && <Text style={styles.mobileBudgetLabel}>Add</Text>}
      {!isEditing ? (
        <Pressable
          style={styles.rowContent}
          accessibilityRole="button"
          accessibilityLabel="Add amount"
          onPress={toggleEdit}
        >
          <Text style={[styles.rowContent, styles.customFont, styles.bigCross]}>+</Text>
        </Pressable>
      ) : (
        <View style={[
          styles.rowContent,
          styles.row,
          Platform.OS === 'web' ? styles.webAmountEditor : null,
        ]}>
          <TextInput
            style={[
              styles.rowContent,
              {textAlign: 'center'},
              Platform.OS === 'web' ? styles.webAmountInput : null,
            ]}
            keyboardType={
              Platform.OS === 'web'
                ? 'default'
                : Platform.OS === 'ios'
                  ? 'numbers-and-punctuation'
                  : 'numeric'
            }
            autoFocus={true}
            value={amountAdded}
            onChangeText={(value) => {
              setAmountAdded(value);
              setIsAmountInvalid(false);
            }}
            onSubmitEditing={submitAddedAmount}
          />
          <Pressable
            style={Platform.OS === 'web' ? styles.webAmountSubmit : undefined}
            accessibilityRole="button"
            accessibilityLabel="Submit amount"
            onPress={submitAddedAmount}
          >
            <Text style={[styles.customFont, styles.bigCross]}>✓</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
  
  const itemContent = (
  <View style={[
    styles.budgetContainer,
    styles.rowBorder,
    styles.rowPadding,
    styles.rowContainer,
    isCompact ? styles.mobileBudgetContainer : null,
    {alignSelf: 'stretch'},
    isPaidInFull ? styles.paidInFullBudgetRow : null,
    Platform.OS === 'web' ? styles.webBudgetContent : null,
  ]}>
    {/* <Text style={[styles.budgetHeader, styles.rowContent, styles.customFont]}>{description}</Text> */}
    <View style={[
      styles.rowContent,
      styles.categoryDescription,
      isCompact ? styles.mobileBudgetDescription : null,
    ]}>
      <TextInput
        style={[styles.customFont, styles.zeroWidthForPadding]}
        value={budgetDescription}
        onChangeText={(text) => {
          setBudgetDescription(text)
        }}
        onSubmitEditing={() =>{
          updateBudgetDescription && updateBudgetDescription(budgetDescription)
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mark ${description || 'budget item'} as ${budgetType === 'fixed' ? 'variable' : 'fixed'}`}
        accessibilityHint="Tap to switch between fixed and variable"
        onPress={() => updateBudgetType?.(budgetType === 'fixed' ? 'variable' : 'fixed')}
      >
        <Text style={[styles.customFont, styles.categoryType, styles.categoryTypeToggle]}>
          {budgetType === 'fixed' ? 'Fixed' : 'Variable'}
        </Text>
      </Pressable>
    </View>
    {isCompact ? (
      <View style={styles.mobileBudgetFields}>
        {budgetField}
        {paidField}
        {dueDateField}
        {addAmountField}
      </View>
    ) : (
      <>
        {budgetField}
        {paidField}
        {dueDateField}
        {addAmountField}
      </>
    )}
  </View>
 );

 const itemWithValidation = (
   <View style={Platform.OS === 'web' ? styles.webBudgetItem : undefined}>
     {itemContent}
     {isEditing && isAmountInvalid && (
       <Text style={[styles.customFont, styles.errorText]}>
         Enter an amount with up to two decimal places. The paid amount cannot be less than zero.
       </Text>
     )}
   </View>
 );

 if (Platform.OS === 'web') {
   return (
     <View style={styles.webSwipeableRow}>
       {itemWithValidation}
       <Pressable
         accessibilityRole="button"
         accessibilityLabel={`Delete ${description || 'budget item'}`}
         style={[styles.rightAction, styles.center]}
         onPress={() => callDeleteWithId(id)}
       >
         <Text style={styles.webDeleteText}>Delete</Text>
       </Pressable>
     </View>
   );
 }

 return (
  <ReanimatedSwipeable
     friction={2}
     enableTrackpadTwoFingerGesture
     rightThreshold={40}
     renderRightActions={(_, drag) => (
       <RightAction drag={drag} itemId={id} callDelete={callDeleteWithId} />
     )}
   >
     {itemWithValidation}
   </ReanimatedSwipeable>
 );
};

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
    const historyItemContent = (
        <Pressable
          style={Platform.OS === 'web' ? styles.webHistoryContent : undefined}
          onPress={() => toggleExpandHistoryItem(item.id)}
        >
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
              budgetType={item.budgetType}
                  /> }
            keyExtractor={item => item.id}
            numColumns={1}
            ListHeaderComponent={() => (
              <View style={styles.center}>
                <Text>{trimmedTitle}</Text>
                <Text>Total Budget: $ {item.totalBudget.toFixed(2)}</Text>
              </View>
            )}
            />
        )}
      </View>
      </Pressable>
    );

    if (Platform.OS === 'web') {
      return (
        <View style={styles.webSwipeableRow}>
          {historyItemContent}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${trimmedTitle || 'budget history'}`}
            style={[styles.rightAction, styles.center]}
            onPress={() => { void callDeleteHistoryItemWithId(item.id); }}
          >
            <Text style={styles.webDeleteText}>Delete</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <ReanimatedSwipeable
        friction={2}
        enableTrackpadTwoFingerGesture
        rightThreshold={40}
        renderRightActions={(_, drag) => (
          <RightAction
            drag={drag}
            itemId={item.id}
            callDelete={callDeleteHistoryItemWithId}
          />
        )}
      >
        {historyItemContent}
      </ReanimatedSwipeable>
    );
  }
  useEffect(() => {
    const getHistoryItems = async () => {
      setIsLoading(true);
      try {
        if (isLocalOnlyMode) {
          setHistoryItemsWithId(await GetBudgetHistoryItemsFromStorage(userEmail));
          return;
        }
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
          totalBudget?: number;
        }) => ({
          id: entry.historyId,
          budgetId: entry.budgetId,
          budgetName: entry.budgetName,
          totalBudget: normalizeCurrencyAmount(
            entry.totalBudget ?? sumBudgetAmounts(entry.budgetItems),
          ),
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
      totalBudget: normalizeCurrencyAmount(
        parsed.totalBudget ?? sumBudgetAmounts(Array.isArray(parsed) ? parsed : (parsed.items || [])),
      ),
      items: Array.isArray(parsed) ? parsed : (parsed.items || []),
    };
  });
}


async function GetBudgetItems(userEmail: string): Promise<BudgetData[]> {
  try{
    let budgetItem = storage.getString(accountStorageKey(budget_items_key, userEmail))
      if (budgetItem){
        return normalizeBudgetItems(JSON.parse(budgetItem));
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
      const parsedBudget = JSON.parse(storedBudget) as Budget;
      return {
        ...parsedBudget,
        budgetItems: normalizeBudgetItems(parsedBudget.budgetItems),
        totalIncome: normalizeBudgetIncome(parsedBudget.totalIncome),
      };
    }

    const localBudgets = GetLocalBudgets(userEmail);
    if (localBudgets.length > 0) {
      const firstBudget = {
        ...localBudgets[0],
        budgetItems: normalizeBudgetItems(localBudgets[0].budgetItems),
        totalIncome: normalizeBudgetIncome(localBudgets[0].totalIncome),
      };
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
      totalIncome: DEFAULT_TOTAL_INCOME,
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
  const budgetToSave = {...budget, pendingSync: !isLocalOnlyMode};
  UpsertLocalBudget(budgetToSave, userEmail);
  const activeBudgetKey = accountStorageKey(budget_key, userEmail);
  storage.set(activeBudgetKey, JSON.stringify(budgetToSave));
  storage.set(accountStorageKey(budget_items_key, userEmail), JSON.stringify(budget.budgetItems));
  storage.set(accountStorageKey(title_key, userEmail), budget.name);
  if (isLocalOnlyMode) return;

  const previousSave = budgetSaveRequests.get(budget.budgetId) ?? Promise.resolve();
  const saveRequest = previousSave.catch(() => undefined).then(async () => {
    const response = await fetch(`${apiUrl}/budgets`, {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({
        budgetId: budget.budgetId,
        name: budget.name,
        budgetItems: budget.budgetItems,
        totalIncome: budget.totalIncome,
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Unable to save budget');
    }
  });
  budgetSaveRequests.set(budget.budgetId, saveRequest);
  try {
    await saveRequest;
    const storedBudget = storage.getString(activeBudgetKey);
    const latestLocalBudget = storedBudget
      ? JSON.parse(storedBudget) as Budget
      : null;
    if (
      latestLocalBudget?.budgetId === budget.budgetId &&
      latestLocalBudget.name === budget.name &&
      latestLocalBudget.totalIncome === budget.totalIncome &&
      JSON.stringify(latestLocalBudget.budgetItems) === JSON.stringify(budget.budgetItems)
    ) {
      const syncedBudget = {...latestLocalBudget, pendingSync: false};
      UpsertLocalBudget(syncedBudget, userEmail);
      storage.set(activeBudgetKey, JSON.stringify(syncedBudget));
    }
  } catch (error) {
    console.error('Failed to save budget to server', error);
  } finally {
    if (budgetSaveRequests.get(budget.budgetId) === saveRequest) {
      budgetSaveRequests.delete(budget.budgetId);
    }
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
    if (isLocalOnlyMode) {
      const historyId = UUID();
      storage.set(`${accountHistoryPrefix(budget.ownerEmail)}${historyId}`, JSON.stringify({
        budgetId: budget.budgetId,
        budgetName: budget.name,
        totalBudget: sumBudgetAmounts(budget.budgetItems),
        items: budget.budgetItems,
      }));
      return true;
    }

    const saveResponse = await fetch(`${apiUrl}/budgets`, {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({
        budgetId: budget.budgetId,
        name: budget.name,
        budgetItems: budget.budgetItems,
        totalIncome: budget.totalIncome,
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
        totalBudget: sumBudgetAmounts(budget.budgetItems),
      }),
    });
    const historyResult = await historyResponse.json();
    if (!historyResponse.ok) {
      throw new Error(historyResult.error || 'Unable to archive the current budget.');
    }

    storage.set(`${accountHistoryPrefix(budget.ownerEmail)}${historyId}`, JSON.stringify({
      budgetId: budget.budgetId,
      budgetName: budget.name,
      totalBudget: sumBudgetAmounts(budget.budgetItems),
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

function BudgetHeader({
  budgetAmountRemaining,
  budgetedTotal,
  budgetSavings,
  currentBudgetTitle,
  totalIncome,
  onTotalIncomeChange,
  onTotalIncomeDraftChange,
  getTitleFunction,
  onTitleChange,
  userEmail,
}: {
  budgetAmountRemaining?: number;
  budgetedTotal?: number;
  budgetSavings: number;
  currentBudgetTitle: string;
  totalIncome: number;
  onTotalIncomeChange: (amount: number) => void;
  onTotalIncomeDraftChange: (amount: string) => void;
  getTitleFunction?: () => void;
  onTitleChange?: (title: string, previousTitle: string) => void;
  userEmail: string;
}) {
  const [totalSetBudgetAmount, setTotalBudgetAmount] = useState(totalIncome);
  const [totalIncomeInput, setTotalIncomeInput] = useState(totalIncome.toFixed(2));
  const [savedTitle, setSavedTitle] = useState<string>(currentBudgetTitle);
  const potentialSurplus = totalSetBudgetAmount - (budgetedTotal ?? 0);

  const updateBudgetTitle = (text: string) => {
    storage.set(accountStorageKey(title_key, userEmail), text)
  }

  useEffect(() => {
      setSavedTitle(currentBudgetTitle)
    }
      , [currentBudgetTitle])

  useEffect(() => {
    setTotalBudgetAmount(totalIncome);
    setTotalIncomeInput(totalIncome.toFixed(2));
  }, [totalIncome]);

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
        <View style={[styles.row, styles.center, {alignSelf: 'center'}]}>
          <Text style={[styles.customFont, styles.headerFontSize, {textAlign: 'center'}]}>Total Income: $</Text>
          <TextInput
            style={[styles.zeroWidthForPadding, styles.headerFontSize, {flex: 0, textAlign: 'center'}]}
            placeholder="Total Income"
            keyboardType="decimal-pad"
            value={totalIncomeInput}
            onChangeText={(amount) => {
              setTotalIncomeInput(amount);
              onTotalIncomeDraftChange(amount);
              const parsedAmount = Number(amount);
              if (amount.trim() !== '' && Number.isFinite(parsedAmount)) {
                setTotalBudgetAmount(parsedAmount);
              }
            }}
            onEndEditing={() => {
              const parsedAmount = Number(totalIncomeInput);
              if (
                totalIncomeInput.trim() !== '' &&
                Number.isFinite(parsedAmount) &&
                /^\d*\.?\d{0,2}$/.test(totalIncomeInput.trim())
              ) {
                const normalizedAmount = normalizeCurrencyAmount(parsedAmount);
                onTotalIncomeChange(normalizedAmount);
                setTotalBudgetAmount(normalizedAmount);
                setTotalIncomeInput(normalizedAmount.toFixed(2));
                onTotalIncomeDraftChange(normalizedAmount.toFixed(2));
              } else {
                setTotalIncomeInput(totalIncome.toFixed(2));
                setTotalBudgetAmount(totalIncome);
                onTotalIncomeDraftChange(totalIncome.toFixed(2));
              }
            }}
          />
        </View>
        <Text style={[styles.customFont, styles.headerFontSize]}>Budget Total: $ {budgetedTotal?.toFixed(2)}</Text>
        <Text style={[styles.customFont, styles.headerFontSize]}>Remaining: $ {budgetAmountRemaining?.toFixed(2)}</Text>
        <Text style={[styles.customFont, styles.headerFontSize, styles.savingsText]}>
          Potential Savings: $ {budgetSavings.toFixed(2)}
        </Text>
        <View style={[styles.row, styles.center]}>
        <Text style={[styles.customFont, styles.headerFontSize
        ]}>Surplus: $ </Text><Text style={[styles.flexEnd, styles.headerFontSize, {color: potentialSurplus >= 0 ? 'green' : 'red'}]}>{potentialSurplus.toFixed(2)}</Text>
        </View>
      </View>
    );
}


function TableHeader(){
  const {width} = useWindowDimensions();
  if (width < 600) return null;

  return (<View style={[styles.rowContainer, styles.rowPadding, styles.tableHeaderPadding]}>
          <Text
          style={[styles.boldText, styles.rowContent, styles.customFont]}>Description / Type</Text>
    <Text style={[styles.boldText, styles.rowContent, styles.customFont]}>Budget</Text>
    <Text style={[styles.boldText, styles.rowContent, styles.customFont]}>Paid</Text>
    <Text style={[styles.boldText, styles.rowContent, styles.customFont]}>Due Date</Text>
    <Text style={[styles.boldText, styles.rowContent, styles.customFont]}>Add</Text>
  </View>);
}

function FooterComponent({addBudgetItem}: {addBudgetItem: (arg0: BudgetData) => void}){
  const [budgetDescription, setBudgetDescription] = useState<string>('');
  const [budgetDate, setBudgetDate] = useState<string>('');
  const [budgetSetDate, setBudgetSetDate] = useState<Date>(new Date());
  const [budgetAmount, setBudgetAmount] = useState<string>('');
  const [budgetType, setBudgetType] = useState<BudgetType>('fixed');
  const [isAddingItem, setIsAddingItem] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [showEditDate, setShowEditDate]  = useState<boolean>(false);
  const toggleAddItem = () => {
      setIsAddingItem(!isAddingItem);
  }

  const parsedBudgetAmount = Number(budgetAmount);
  const isInvalidEntry = () => (
    budgetDescription.trim() === '' ||
    !budgetAmount.trim() ||
    !Number.isFinite(parsedBudgetAmount) ||
    parsedBudgetAmount <= 0 ||
    !/^\d*\.?\d{0,2}$/.test(budgetAmount) ||
    !budgetSetDate ||
    Number.isNaN(budgetSetDate.getTime())
  );

  const saveNewBudgetItem = () => {
    if (isInvalidEntry()) {
      setShowError(true);
      return;
    }

    addBudgetItem({
      id: '',
      description: budgetDescription.trim(),
      budget: normalizeCurrencyAmount(parsedBudgetAmount),
      amount: 0,
      date: budgetSetDate.toISOString().split('T')[0],
      budgetType,
    });
    setShowError(false);
    setIsAddingItem(false);
    setBudgetDescription('');
    setBudgetAmount('');
    setBudgetType('fixed');
  }
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
            keyboardType="decimal-pad"
            value={budgetAmount}
            onChangeText={setBudgetAmount}
            style={[styles.rowContent, styles.zeroWidthForPadding]}
          />
          <Pressable
            style={[styles.rowContent, styles.center]}
            accessibilityRole="button"
            accessibilityLabel={`Budget type: ${budgetType}. Tap to switch`}
            accessibilityHint="Tap to switch between fixed and variable"
            onPress={() => setBudgetType(budgetType === 'fixed' ? 'variable' : 'fixed')}
          >
            <Text style={[styles.customFont, styles.categoryType, styles.categoryTypeToggle]}>
              Type: {budgetType === 'fixed' ? 'Fixed' : 'Variable'}
            </Text>
          </Pressable>
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
            onPress={saveNewBudgetItem}>
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

function sortTransactionsNewestFirst(transactions: TransactionData[]): TransactionData[] {
  return [...transactions].sort((first, second) => {
    const firstDate = Date.parse(first.date);
    const secondDate = Date.parse(second.date);
    const firstIsValid = Number.isFinite(firstDate);
    const secondIsValid = Number.isFinite(secondDate);

    if (firstIsValid && secondIsValid) return secondDate - firstDate;
    if (firstIsValid) return -1;
    if (secondIsValid) return 1;
    return 0;
  });
}

function BudgetComponent({navigation, onLogout, userEmail} : {
  navigation: any;
  onLogout: () => void;
  userEmail: string;
}){
  const {width} = useWindowDimensions();
  // TODO : Fetch budget data from API or local storage
  let budgetDataItems: BudgetData[] = [], currentBudgetData
  const [budgetData, setBudgetData] = useState<BudgetData[]>(budgetDataItems);
  const [budgetId, setBudgetId] = useState<string>('');
  const [budgetOwnerEmail, setBudgetOwnerEmail] = useState<string>(userEmail);
  const [totalIncome, setTotalIncome] = useState<number>(DEFAULT_TOTAL_INCOME);
  const totalIncomeDraft = useRef(totalIncome.toFixed(2));
  const [transactionData, setTransactionData] = useState<TransactionData[]>([]);
  const [budgetTitle, setBudgetTitle] = useState<string>('');
  const [showTransactions, setShowTransactions] = useState<boolean>(false);
  const [showCloseButton, setShowCloseButton] = useState<boolean>(false);
  const [showMenuButtons, setShowMenuButtons] = useState<boolean>(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isLoadingBudget, setIsLoadingBudget] = useState(true);
  const skipInitialBudgetSave = useRef(false);

  const budget: Budget = {
    budgetId,
    name: budgetTitle,
    ownerEmail: budgetOwnerEmail,
    budgetItems: budgetData,
    totalIncome,
  };
  const [availableBudgets, setAvailableBudgets] = useState<Budget[]>([]);

  const getCurrentBudget = async () => {
    let currentBudget: Budget | null = null;
    const applyCurrentBudget = (loadedBudget: Budget) => {
      skipInitialBudgetSave.current = true;
      setBudgetId(loadedBudget.budgetId || UUID());
      setBudgetTitle(loadedBudget.name || '');
      setBudgetOwnerEmail(loadedBudget.ownerEmail || userEmail);
      setBudgetData(normalizeBudgetItems(loadedBudget.budgetItems));
      setTotalIncome(normalizeBudgetIncome(loadedBudget.totalIncome));
    };

    try {
      try {
        const localBudgets = GetLocalBudgets(userEmail);
        if (localBudgets.length > 0) {
          setAvailableBudgets(localBudgets);
        }

        currentBudget = await GetBudget(userEmail);
        if (currentBudget) {
          applyCurrentBudget(currentBudget);
        }
      } catch (error) {
        console.log(error);
      }

      if (!currentBudget || isLocalOnlyMode) return;
      if (currentBudget.pendingSync) {
        void SaveBudget(currentBudget, userEmail);
        return;
      }

      try {
        const response = await fetch(
          `${apiUrl}/budgets/${encodeURIComponent(currentBudget.budgetId)}`,
          { headers: apiHeaders() },
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Unable to refresh the current budget.');
        }

        const refreshedBudget = {
          ...result,
          budgetItems: normalizeBudgetItems(result.budgetItems),
          totalIncome: normalizeBudgetIncome(result.totalIncome ?? currentBudget.totalIncome),
        } as Budget;
        UpsertLocalBudget(refreshedBudget, userEmail);
        storage.set(accountStorageKey(budget_key, userEmail), JSON.stringify(refreshedBudget));
        storage.set(
          accountStorageKey(budget_items_key, userEmail),
          JSON.stringify(refreshedBudget.budgetItems),
        );
        storage.set(accountStorageKey(title_key, userEmail), refreshedBudget.name);
        applyCurrentBudget(refreshedBudget);
      } catch (error) {
        console.log('Unable to refresh the current budget from the server', error);
      }
    } finally {
      setIsLoadingBudget(false);
    }
  };

    const loadAvailableBudgets = async () => {
      const localBudgets = GetLocalBudgets(userEmail);
      setAvailableBudgets(localBudgets);
      if (isLocalOnlyMode) return;

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
      if (isLocalOnlyMode) {
        const localBudget = GetLocalBudgets(userEmail).find(
          (budget) => budget.budgetId === selectedBudget.budgetId,
        );
        if (!localBudget) return;
        await ClearTransactionData(userEmail);
        setTransactionData([]);
        setBudgetId(localBudget.budgetId);
        setBudgetTitle(localBudget.name);
        setBudgetOwnerEmail(localBudget.ownerEmail || userEmail);
        setBudgetData(normalizeBudgetItems(localBudget.budgetItems));
        setTotalIncome(normalizeBudgetIncome(localBudget.totalIncome));
        return;
      }

      const localBudget = GetLocalBudgets(userEmail).find(
        (budget) => budget.budgetId === selectedBudget.budgetId,
      );
      if (localBudget?.pendingSync) {
        await SaveBudget(localBudget, userEmail);
        await ClearTransactionData(userEmail);
        setTransactionData([]);
        setBudgetId(localBudget.budgetId);
        setBudgetTitle(localBudget.name);
        setBudgetOwnerEmail(localBudget.ownerEmail || userEmail);
        setBudgetData(normalizeBudgetItems(localBudget.budgetItems));
        setTotalIncome(normalizeBudgetIncome(localBudget.totalIncome));
        return;
      }

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
        setBudgetData(normalizeBudgetItems(result.budgetItems));
        setTotalIncome(normalizeBudgetIncome(result.totalIncome));
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
          setBudgetData(normalizeBudgetItems(localBudget.budgetItems));
          setTotalIncome(normalizeBudgetIncome(localBudget.totalIncome));
          return;
        }
        Alert.alert(
          'Unable to switch budget',
          error instanceof Error ? error.message : 'Please try again later.',
        );
      }
    };

    const loadAcceptedBudget = async (invitation: {budgetId: string}) => {
      if (isLocalOnlyMode) {
        const result = getAcceptedLocalBudget(userEmail, invitation.budgetId);
        if (!result) throw new Error('Unable to load the shared budget.');
        await ClearTransactionData(userEmail);
        setTransactionData([]);
        setBudgetId(result.budgetId);
        setBudgetTitle(result.name);
        setBudgetOwnerEmail(result.ownerEmail || userEmail);
        setBudgetData(normalizeBudgetItems(result.budgetItems));
        setTotalIncome(normalizeBudgetIncome(result.totalIncome));
        UpsertLocalBudget({
          ...result,
          budgetItems: normalizeBudgetItems(result.budgetItems),
        }, userEmail);
        await loadAvailableBudgets();
        setShowMenuButtons(false);
        return;
      }

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
      setBudgetData(normalizeBudgetItems(result.budgetItems));
      setTotalIncome(normalizeBudgetIncome(result.totalIncome));
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
        totalIncome: DEFAULT_TOTAL_INCOME,
      };
      setBudgetId(newBudget.budgetId);
      setBudgetOwnerEmail(newBudget.ownerEmail);
      setBudgetTitle(newBudget.name);
      setBudgetData(newBudget.budgetItems);
      setTotalIncome(newBudget.totalIncome);
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
    try {
      const result = await GetBudgetTitle(userEmail);
      if (result) setBudgetTitle(result);
    } catch (error) {
      console.log(error);
    }
  };

  const updateTotalIncome = (amount: number) => {
    setTotalIncome(amount);
    void SaveBudget({...budget, totalIncome: amount}, userEmail);
  };

  const updateTotalIncomeDraft = (amount: string) => {
    totalIncomeDraft.current = amount;
  };

  useEffect(() => {
    totalIncomeDraft.current = totalIncome.toFixed(2);
  }, [budgetId, totalIncome]);

  const getBudgetForSave = (): Budget => {
    const draft = totalIncomeDraft.current.trim();
    const parsedAmount = Number(draft);
    const hasValidDraft =
      draft !== '' &&
      Number.isFinite(parsedAmount) &&
      /^\d*\.?\d{0,2}$/.test(draft);

    return {
      ...budget,
      totalIncome: hasValidDraft ? normalizeCurrencyAmount(parsedAmount) : totalIncome,
    };
  };

  useEffect(() => {
    getCurrentBudget();
    getCurrentTransactions();
    void loadAvailableBudgets();
  }, []);

  useEffect(() => {
    if (isLoadingBudget) return;
    if (skipInitialBudgetSave.current) {
      skipInitialBudgetSave.current = false;
      return;
    }
    if (!budgetId || !budgetTitle.trim()) return;
    void SaveBudget(getBudgetForSave(), userEmail);
  }, [budgetId, budgetTitle, budgetData, userEmail, isLoadingBudget]);

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
    setTotalIncome(DEFAULT_TOTAL_INCOME);
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

  const updateBudgetType = (id: string, budgetType: BudgetType) => {
    const updatedItems = budgetData.map(item => (
      item.id === id ? {...item, budgetType} : item
    ));
    setBudgetData(updatedItems);
    SaveBudgetItems(updatedItems, userEmail);
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
  const largestExistingId = budgetData.reduce((maxId, item) => {
    const itemId = Number.parseInt(item.id, 10);
    return Number.isFinite(itemId) ? Math.max(maxId, itemId) : maxId;
  }, 0);
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
  const budgetSavings = sumVariableBudgetSavings(budgetData);
  const sortedBudgetData = [...budgetData].sort(
    (first, second) =>
      Number(first.budget === first.amount) - Number(second.budget === second.amount),
  );

  const deleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const response = await fetch(`${apiUrl}/account`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to delete account.');
      }

      try {
        clearLocalAccountData(userEmail);
      } catch (error) {
        console.error('Account was deleted, but local data could not be cleared', error);
        Alert.alert(
          'Account deleted',
          'Your account was deleted, but some data could not be removed from this device. Clear the app data in your device settings.',
        );
      }
      setShowMenuButtons(false);
      onLogout();
    } catch (error) {
      Alert.alert(
        'Unable to delete account',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

    return (
            <View style={[styles.flex, styles.backgroundColor, styles.menuScreen]}>
            <View style={[styles.flexStart, showMenuButtons && styles.menuContainer]}>
              <Pressable onPress={() => setShowMenuButtons(!showMenuButtons)}>
                <Text style={[styles.rowPadding, styles.rowBorder, styles.customFont, styles.boldText]}>
                  {showMenuButtons ? 'Close' : 'Menu'}
                  </Text>
              </Pressable>
              {showMenuButtons && (
                <View style={{flexDirection: 'column'}}>
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
                      <BudgetShareComponent budget={budget} localOnly={isLocalOnlyMode} />
                    </BudgetProvider>
                  )}
                  <BudgetInvitationComponent
                    email={userEmail}
                    localOnly={isLocalOnlyMode}
                    onBudgetAccepted={loadAcceptedBudget}
                  />
                  {!isLocalOnlyMode && <LogOutButton onLogout={onLogout}/>}
                  {!isLocalOnlyMode && (
                    <DeleteAccountButton
                      onDelete={deleteAccount}
                      isDeleting={isDeletingAccount}
                    />
                  )}
                </View>
              )}
            </View>
            <View style={[
              width < 600 ? styles.mobileBudgetSummary : styles.flex,
              {
                minHeight: 20,
                marginHorizontal: width < 600 ? 12 : 50,
                marginVertical: width < 600 ? 8 : 50,
              },
            ]}>
            <BudgetHeader
                budgetAmountRemaining={budgetRemaining}
                budgetedTotal={totalBudgetAmount}
                budgetSavings={budgetSavings}
                currentBudgetTitle={budgetTitle}
                totalIncome={totalIncome}
                onTotalIncomeChange={updateTotalIncome}
                onTotalIncomeDraftChange={updateTotalIncomeDraft}
                getTitleFunction={getTitle}
                onTitleChange={recordBudgetTitleChange}
                userEmail={userEmail}
                />
            </View>
            <TableHeader />
        <FlatList
                data={sortedBudgetData}
            renderItem={({item}) => <BudgetItem
              id={item.id}
              description={item.description}
              budget={item.budget}
              amount={item.amount}
              date={item.date}
              budgetType={item.budgetType}
              addAmount={(amount: number) => {
                updateBudgetAmountUsed(item.id, amount)
              }}
              adjustBudgetAmount={(amount: number) => {updateBudgetAmount(item.id, amount)}}
              onDeleteConfirm={(id: string) => {
                removeBudgetItem(id)
              }}
              updateBudgetDescription={(description: string) => {
                updateBudgetDescription(item.id, description)
              }}
              updateBudgetType={(budgetType: BudgetType) => {
                updateBudgetType(item.id, budgetType)
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
                      {sortTransactionsNewestFirst(transactionData).map((transaction) => (
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
                    const archived = await SaveBudgetItemToHistoryPage(getBudgetForSave());
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
            {showMenuButtons && (
            <Pressable
              style={styles.menuBackdrop}
              onPress={() => setShowMenuButtons(false)}
              accessibilityLabel="Close menu"
            />
            )}
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

function DeleteAccountButton({onDelete, isDeleting}: {
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, all budgets you own, and your archived budget history. Budgets shared with you may still belong to their owners.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete Account', style: 'destructive', onPress: onDelete},
      ],
    );
  };

  return (
    <View style={[styles.flexStart]}>
      <Pressable onPress={confirmDelete} disabled={isDeleting}>
        <Text style={[styles.rowPadding, styles.rowBorder, styles.customFont, styles.boldText, {color: 'red'}]}>
          {isDeleting ? 'Deleting Account...' : 'Delete Account'}
        </Text>
      </Pressable>
    </View>
  );
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
    mobileBudgetContainer: {
      alignItems: 'stretch',
      flexDirection: 'column',
      justifyContent: 'flex-start',
    },
    mobileBudgetDescription: {
      flex: 0,
      width: '100%',
    },
    mobileBudgetFields: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 8,
      width: '100%',
    },
    mobileBudgetField: {
      alignItems: 'stretch',
      flex: 0,
      flexBasis: '48%',
      justifyContent: 'center',
      marginBottom: 8,
      minWidth: 0,
      width: '48%',
    },
    mobileBudgetLabel: {
      color: '#5B6472',
      fontSize: 10,
      marginBottom: 2,
    },
    mobileBudgetSummary: {
      alignSelf: 'stretch',
      flex: 0,
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
    paidInFullBudgetRow: {
      backgroundColor: '#F0F0F0',
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
    menuScreen: {
      position: 'relative',
    },
    menuContainer: {
      alignSelf: 'flex-start',
      zIndex: 2,
      elevation: 2,
    },
    menuBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 1,
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
  categoryDescription: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
    minWidth: 0,
  },
  categoryType: {
    color: '#5B6472',
    fontSize: 10,
  },
  categoryTypeToggle: {
    textDecorationLine: 'underline',
  },
  savingsText: {
    color: '#15803D',
  },
  overBudgetAmount: {
    color: '#9B3A38',
    backgroundColor: '#FCEDEA',
    borderRadius: 4,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rightAction: { width: 50, height: 48, backgroundColor: 'red', borderRadius: 10 },
  webSwipeableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  webBudgetContent: {
    flex: 1,
  },
  webBudgetItem: {
    flex: 1,
    minWidth: 0,
  },
  webAmountEditor: {
    minWidth: 0,
  },
  webAmountInput: {
    minWidth: 0,
    flexShrink: 1,
  },
  webAmountSubmit: {
    flexShrink: 0,
    paddingHorizontal: 6,
  },
  webHistoryContent: {
    flex: 1,
  },
  webDeleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  brandHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  brandBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  brandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 18,
  },
  formContainer: {
    marginVertical: 14,
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
  passwordHint: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  input: {
    height: 52,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  passwordInput: {
    flex: 1,
    height: 52,
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
    borderRadius: 12,
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
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 20,
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
    alignItems: 'center',
    marginTop: 18,
    flexWrap: 'wrap',
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
