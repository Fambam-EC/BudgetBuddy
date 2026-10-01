/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  Dimensions: { get: () => ({ width: 1024, height: 768 }) },
  FlatList: 'FlatList',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Platform: { OS: 'web' },
  Pressable: 'Pressable',
  SafeAreaView: 'SafeAreaView',
  StatusBar: 'StatusBar',
  StyleSheet: { create: (styles: object) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  useColorScheme: () => 'light',
}));

jest.mock('react-native-get-random-values', () => ({}));

jest.mock('@hugeicons/react-native', () => ({ HugeiconsIcon: 'HugeiconsIcon' }));

jest.mock('../Helpers/storage', () => ({
  storage: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
    remove: jest.fn(),
    getAllKeys: jest.fn(() => []),
  },
}));

jest.mock('uuid', () => ({ v4: () => 'test-budget-id' }));

jest.mock('react-native-safe-area-context', () => {
  return { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' };
});

jest.mock('react-native-gesture-handler', () => {
  return { GestureHandlerRootView: 'GestureHandlerRootView', default: 'Swipeable' };
});

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => 'ReanimatedSwipeable');

jest.mock('@react-navigation/native', () => {
  return { NavigationContainer: 'NavigationContainer' };
});

jest.mock('@react-navigation/native-stack', () => {
  return { createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) };
});

jest.mock('react-native-reanimated', () => {
  return {
    __esModule: true,
    default: { View: 'AnimatedView' },
    useAnimatedStyle: () => ({}),
  };
});

test('starts in local web mode without making API requests', async () => {
  expect(typeof App).toBe('function');
  const fetchMock = jest.fn();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock;

  try {
    await ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<App />);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
