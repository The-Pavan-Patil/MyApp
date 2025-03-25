import {FunctionComponent, useEffect, useState} from "react";
import {KeyboardAvoidingView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert} from "react-native";
import {auth} from "./firebase";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Lottie from 'lottie-react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaProvider } from "react-native-safe-area-context";
import animationData from './assets/Animation.json';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,sendEmailVerification } from "firebase/auth";

type RootStackParamList = {
    Home: undefined;
    MQTTClient: undefined;
    LoginScreen: undefined
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;

const LoginScreen: FunctionComponent = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSigningUp, setIsSigningUp] = useState(false); // Add this state
    const [showPassword, setShowPassword] = useState(false);
    const navigation = useNavigation<LoginScreenNavigationProp>();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user && !isSigningUp) {
            if (user.emailVerified) {
              navigation.replace("MQTTClient");
            } else {
              Alert.alert(
                "Verify Your Email",
                "Please verify your email before accessing the app."
              );
              auth.signOut();
            }
          }
        });
        return unsubscribe;
      }, [navigation, isSigningUp]);

   const handleSignUp = async () => {
  setIsSigningUp(true);
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Send verification email
    await sendEmailVerification(user);
    
    Alert.alert(
      "Verify Your Email",
      "A verification email has been sent. Please verify your email before logging in.",
      [
        {
          text: "OK",
          onPress: () => {
            setEmail('');
            setPassword('');
            auth.signOut(); // Sign out until verification
          }
        }
      ]
    );
  } catch (error: any) {
    Alert.alert("Error", error.message);
  } finally {
    setIsSigningUp(false);
  }
};


const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      if (!user.emailVerified) {
        await auth.signOut();
        Alert.alert(
          "Email Not Verified",
          "Please verify your email first. We've sent you a verification email.",
          [
            {
              text: "Resend Verification",
              onPress: async () => {
                await sendEmailVerification(user);
                Alert.alert("Verification Sent", "Please check your email.");
              }
            },
            { text: "OK" }
          ]
        );
        return;
      }
      
      // Proceed with normal login if verified
      navigation.replace("MQTTClient");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };
   

    return (
        <SafeAreaProvider>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={'padding'}
            >
         <Text style={styles.header}>Vita-Link</Text>
        <View style={styles.animationContainer}>
        <Lottie
          source={animationData}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        placeholder={'Email'}
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                    <View style={styles.passwordContainer}>
                        <TextInput
                            placeholder={'Password'}
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <Icon
                            name={showPassword ? 'eye' : 'eye-slash'}
                            size={20}
                            color="#666"
                            />          
                        </TouchableOpacity>
                    </View>
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
        paddingTop: 20, // Add some top padding
    },
    inputContainer: {
        width: '80%',
    },
    header: {
        fontSize: 24,
        fontWeight: '800',
        color: '#2c3e50',
        letterSpacing: 0.8,
      },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    input: {
        backgroundColor: 'white',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 5,
    },
    passwordContainer: {
        position: 'relative',
        marginTop: 10,
    },
    eyeIcon: {
        position: 'absolute',
        right: 15,
        top: 12,
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
    },
    animationContainer: {
        height: 200,
        width: '100%',
        marginBottom: 20,
      },
      animation: {
        flex: 1,
      },
      // Adjust container to add spacing
      
});

export default LoginScreen;