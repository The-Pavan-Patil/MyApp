import {FunctionComponent, useEffect, useState} from "react";
import {KeyboardAvoidingView, StyleSheet, Text, TextInput, TouchableOpacity, View} from "react-native";
import {auth} from "./firebase";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Alert } from 'react-native';


import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged 
  } from "firebase/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";


  type RootStackParamList = {
    Home: undefined;
    MQTTClient: undefined;
    LoginScreen: undefined
  };

  type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;

 
const LoginScreen: FunctionComponent = () => {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigation = useNavigation<LoginScreenNavigationProp>();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            navigation.replace("MQTTClient");
          }
        });
        return unsubscribe;
    }, [navigation]);

    const handleSignUp = () => {
        createUserWithEmailAndPassword(auth, email, password)
          .then((userCreds) => {
            const user = userCreds.user;
            console.log('Registered with: ', user?.email);
          })
          .catch(error => Alert.alert(error.message))
      }

      const handleLogin = () => {
        signInWithEmailAndPassword(auth, email, password)
          .then((userCreds) => {
            const user = userCreds.user;
            console.log('LoggedIn with: ', user?.email);
          })
          .catch(error => Alert.alert(error.message));
      };    


    return (
        <SafeAreaProvider>
        <KeyboardAvoidingView
            style={styles.container}
            behavior={'padding'}
        >
            <View
                style={styles.inputContainer}
            >
                <TextInput
                    placeholder={'Email'}
                    style={styles.input}
                    value={email}
                    onChangeText={text => setEmail(text)}
                ></TextInput>
                <TextInput
                    placeholder={'Password'}
                    style={styles.input}
                    value={password}
                    onChangeText={pwd => setPassword(pwd)}
                    secureTextEntry
                ></TextInput>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    onPress={handleLogin}
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>Login</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleSignUp}
                    style={[styles.button, styles.buttonOutline]}
                >
                    <Text style={styles.buttonOutlineText}>Register</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
        </SafeAreaProvider>
        );
}



const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputContainer: {
        width: '80%',
    },
    input: {
        backgroundColor: 'white',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 5,
    },
    buttonContainer: {
        width: '60%',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
    },
    button: {
        backgroundColor: '#0782F9',
        width: '100%',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonOutline: {
        backgroundColor: 'white',
        marginTop: 5,
        borderColor: '#0782F9',
        borderWidth: 1,
    },
    buttonOutlineText: {
        color: '#0782F9',
        fontWeight: '700',
        fontSize: 16,
    },
    buttonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
    }
});


export default LoginScreen;

