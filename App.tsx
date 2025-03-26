
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator} from "@react-navigation/native-stack";
import MQTTClient from "./Screens/MQTTClient";
import LoginScreen from "./Screens/LoginScreen";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import ReportScreen from './Screens/ReportScreen';

enableScreens();

export type RootStackParamList = {
  LoginScreen: undefined;
  MQTTClient: undefined;
  ReportScreen: undefined;
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
          <Stack.Screen 
          name="ReportScreen" 
          component={ReportScreen}
          options={{ title: 'Health Report' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}