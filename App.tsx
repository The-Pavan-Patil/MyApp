
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator} from "@react-navigation/native-stack";
import MQTTClient from "./Screens/MQTTClient";
import LoginScreen from "./Screens/LoginScreen";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import ReportScreen from './Screens/ReportScreen';
import RegisterScreen from "./Screens/RegisterScreen";
import LoginScreens from "./Screens/LoginScreens";

enableScreens();

export type RootStackParamList = {
  LoginScreens: undefined;
  LoginScreen: undefined;
  MQTTClient: { userType: 'doctor' | 'patient' };
  ReportScreen: { userType: 'doctor' | 'patient' };
  RegisterScreen: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="LoginScreens"
            component={LoginScreens}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="MQTTClient" 
            component={MQTTClient}
            options={{ title: 'Vital Link' }}
          />
           <Stack.Screen name="RegisterScreen" component={RegisterScreen} options={{headerShown: false}}/>
          <Stack.Screen 
          name="ReportScreen" 
          component={ReportScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}