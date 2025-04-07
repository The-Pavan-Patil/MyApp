import { FunctionComponent, useEffect, useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from "react-native";
import { auth } from "../firebase";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Lottie from 'lottie-react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaProvider } from "react-native-safe-area-context";
import animationData from '../assets/Animation.json';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { app } from "../firebase";

const db = getFirestore(app);


type RootStackParamList = {
    Home: undefined;
    MQTTClient: { userType: 'doctor' | 'patient' };
    LoginScreen: undefined;
    ReportScreen: { userType: 'doctor' | 'patient' };
    LoginScreens: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<
    RootStackParamList,
    'LoginScreen' | 'MQTTClient' | 'ReportScreen'
>;

const LoginScreen: FunctionComponent = () => {

    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [userType, setUserType] = useState<'doctor' | 'patient' | null>(null)
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSigningUp, setIsSigningUp] = useState(false); // Add this state
    const [showPassword, setShowPassword] = useState(false);
    const navigation = useNavigation<LoginScreenNavigationProp>();
    // Password validation states
    const [hasMinLength, setHasMinLength] = useState(false);
    const [hasUpperCase, setHasUpperCase] = useState(false);
    const [hasLowerCase, setHasLowerCase] = useState(false);
    const [hasNumber, setHasNumber] = useState(false);
    const [hasSpecialChar, setHasSpecialChar] = useState(false);
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;


    useEffect(() => {
        // Update password validations on password change
        setHasMinLength(password.length >= 8);
        setHasLowerCase(/[a-z]/.test(password));
        setHasUpperCase(/[A-Z]/.test(password));
        setHasNumber(/\d/.test(password));
        setHasSpecialChar(/[@$!%*?&]/.test(password));
    }, [password]);

    useEffect(() => {

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && !isSigningUp && userType) {
                if (user.emailVerified) {
                    navigation.replace(
                        userType === 'doctor' ? 'MQTTClient' : 'ReportScreen',
                        { userType }
                    );
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

    const AlreadyRegistered = async () => {
        navigation.replace('LoginScreens')
    }
    const handleSignUp = async () => {
        if (!name || !age) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }
        if (!userType) {
            Alert.alert("Error", "Please select your role first");
            return;
        }
        if (!passwordRegex.test(password)) {
            Alert.alert(
                "Password Requirements",
                "Password must contain:\n- Minimum 8 characters\n- At least one uppercase letter\n- At least one lowercase letter\n- At least one number\n- At least one special character (@$!%*?&)"
            );
            return;
        }
        setIsSigningUp(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Send verification email

            await setDoc(doc(db, "users", user.uid), {
                name,
                age: parseInt(age),
                email,
                userType,
                createdAt: new Date()
            });
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
                            setName('');
                            setAge('');
                            auth.signOut();
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
                <View style={styles.roleContainer}>
                    <TouchableOpacity
                        style={[styles.roleButton, userType === 'doctor' && styles.selectedRole]}
                        onPress={() => setUserType('doctor')}
                    >
                        <Text style={styles.roleText}>I'm a Doctor</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.roleButton, userType === 'patient' && styles.selectedRole]}
                        onPress={() => setUserType('patient')}
                    >
                        <Text style={styles.roleText}>I'm a Patient</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        placeholder={'Full Name'}
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                    />
                    <TextInput
                        placeholder={'Age'}
                        style={styles.input}
                        value={age}
                        onChangeText={setAge}
                        keyboardType="numeric"
                    />
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
                    {/* Password validation messages */}
                <View style={styles.validationContainer}>
                    <Text style={hasMinLength ? styles.valid : styles.invalid}>
                        • At least 8 characters
                    </Text>
                    <Text style={hasUpperCase ? styles.valid : styles.invalid}>
                        • Contains uppercase letter
                    </Text>
                    <Text style={hasLowerCase ? styles.valid : styles.invalid}>
                        • Contains lowercase letter
                    </Text>
                    <Text style={hasNumber ? styles.valid : styles.invalid}>
                        • Contains number
                    </Text>
                    <Text style={hasSpecialChar ? styles.valid : styles.invalid}>
                        • Contains special character (@$!%*?&)
                    </Text>
                </View>
                </View>


                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        onPress={handleSignUp}
                        style={[styles.button, styles.button]}
                    >
                        <Text style={styles.buttonText}>Register</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={AlreadyRegistered} style={[styles.button, styles.buttonOutline]}>
                        <Text style={styles.buttonOutlineText}>Already have an account?</Text>

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
    validationContainer: {
        width: '80%',
        marginVertical: 10,
    },
    valid: {
        color: 'green',
        fontSize: 12,
    },
    invalid: {
        color: 'red',
        fontSize: 12,
    },
    // Adjust container to add spacing

});

export default LoginScreen;