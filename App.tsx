
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator} from "@react-navigation/native-stack";
import MQTTClient from "./MQTTClient";
import LoginScreen from "./LoginScreen";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
enableScreens();

export type RootStackParamList = {
  LoginScreen: undefined;
  MQTTClient: undefined;
  // ... other screens
};
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="LoginScreen"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="MQTTClient" 
            component={MQTTClient}
            options={{ title: 'Vital Link' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}