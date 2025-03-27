import { FunctionComponent, useEffect, useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from "react-native";
import { app, auth } from "../firebase";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Lottie from 'lottie-react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaProvider } from "react-native-safe-area-context";
import animationData from '../assets/Animation.json';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

import { useUserType } from "./useUserType";
import { doc, getDoc, getFirestore } from "firebase/firestore";

type RootStackParamList = {
  Home: undefined;
  MQTTClient: { userType: 'doctor' | 'patient' };
  LoginScreen: undefined;
  ReportScreen: { userType: 'doctor' | 'patient' };
  LoginScreens: undefined;
  RegisterScreen: undefined;
};

type LoginScreensNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;

const LoginScreen: FunctionComponent = () => {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigation = useNavigation<LoginScreensNavigationProp>();

    const SignUp = async () => {
        try {
            navigation.replace('RegisterScreen');
        } catch (error) {
            Alert.alert("Error");
        }
    };
    const db = getFirestore(app);

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
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userType = userData.userType;
        
        // Navigate based on userType
        navigation.replace(
          userType === 'doctor' ? 'MQTTClient' : 'ReportScreen',
          { userType }
        );
      } else {
        Alert.alert("Error", "User data not found");
      }
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
            onPress={SignUp}
            
          >
            <Text style={styles.buttonOutlineText}>Don't have an account?</Text>
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
      marginTop: 1,
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
      paddingTop: 10,
    },
    buttonOutline: {
      backgroundColor: 'white',
      marginTop: 5,
      borderColor: '#0782F9',
      borderWidth: 1,
    },
    buttonOutlineText: {
      padding: 10,
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
    roleContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '80%',
      marginBottom: 20,
    },
    roleButton: {
      width: '48%',
      padding: 12,
      borderRadius: 8,
      backgroundColor: '#e0e0e0',
      alignItems: 'center',
    },
    selectedRole: {
      backgroundColor: '#3498db',
    },
    roleText: {
      color: '#2c3e50',
      fontWeight: '600',
    },
    // Adjust container to add spacing
  
  });

export default LoginScreen;