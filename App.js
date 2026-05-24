import React, { useEffect } from 'react';
import { Text, TextInput, View, ActivityIndicator } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useFonts } from 'expo-font';

export default function App() {
  const [fontsLoaded] = useFonts({
    'SN Pro': require('./src/SNPro/SNPro-Regular.ttf'),
    'SN Pro-Bold': require('./src/SNPro/SNPro-Bold.ttf'),
    'SN Pro-SemiBold': require('./src/SNPro/SNPro-SemiBold.ttf'),
    'SN Pro-Light': require('./src/SNPro/SNPro-Light.ttf'),
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    if (Text.defaultProps == null) Text.defaultProps = {};
    Text.defaultProps.style = {
      ...(Text.defaultProps.style || {}),
      fontFamily: 'SN Pro',
    };

    if (TextInput.defaultProps == null) TextInput.defaultProps = {};
    TextInput.defaultProps.style = {
      ...(TextInput.defaultProps.style || {}),
      fontFamily: 'SN Pro',
    };
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return <AppNavigator />;
}
