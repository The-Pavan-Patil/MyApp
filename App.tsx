
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator} from "@react-navigation/native-stack";
import MQTTClient from "./MQTTClient";
import LoginScreen from "./LoginScreen";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
enableScreens();

const Stack = createNativeStackNavigator();
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
            <Stack.Screen
                options={{ headerShown: false}}
                name={'Login'}
                component={LoginScreen}
            />
            <Stack.Screen name={'MQTTClient'} component={MQTTClient} />
        </Stack.Navigator>
      </NavigationContainer>
      </SafeAreaProvider>
  );
}