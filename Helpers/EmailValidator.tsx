import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';

type EmailValidatorProps = {
  setIsValidEmail: (data: boolean) => void;
  onEmailChange?: (email: string) => void;
};

function EmailValidator({ setIsValidEmail, onEmailChange }: EmailValidatorProps) {
  const [email, setEmail] = useState('');
  const [isValid, setIsValid] = useState(true);

  const validateEmail = (text: string) => {
    // Standard robust email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(text);

    setEmail(text);
    onEmailChange?.(text);
    // Test the input text and update validation state
    setIsValid(valid);
    setIsValidEmail(valid);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, !isValid && styles.errorInput]}
        placeholder="Enter email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={validateEmail}
      />
      {!isValid && <Text style={styles.errorText}>Please enter a valid email address.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  input: { borderBottomWidth: 1, borderColor: '#ccc', padding: 10 },
  errorInput: { borderColor: 'red' },
  errorText: { color: 'red', marginTop: 5, fontSize: 12 },
});
export default EmailValidator;