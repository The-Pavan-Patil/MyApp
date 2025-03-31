// Create a new file ReportScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import MQTT from 'sp-react-native-mqtt';
import { useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { StackNavigationProp } from '@react-navigation/stack';
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app, auth } from '../firebase';
import Icon from 'react-native-vector-icons/FontAwesome';


const MQTT_BROKER_URL = "wss://89db5cc86dc341a691af602183793358.s1.eu.hivemq.cloud:8883";
const COMMAND_TOPIC = "sensor/command";
const TOPICS = ["sensor/ecg", "sensor/temp", "sensor/health", "sensor/emg"];


const StatItem: React.FC<{ label: string, value: string, status?: any }> = ({ label, value, status }) => (
    <View style={styles.statItem}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statValueContainer}>
            {status && <View style={[styles.statusDot, { backgroundColor: status.color }]} />}
            <Text style={styles.statValue}>{value}</Text>
        </View>
    </View>
);
const getHeartRateStatus = (hr: string) => {
    const value = parseFloat(hr);
    if (isNaN(value)) return { status: 'N/A', color: '#7f8c8d' };
    if (value < 60) return { status: 'Low', color: '#e67e22' };
    if (value > 100) return { status: 'High', color: '#e74c3c' };
    return { status: 'Normal', color: '#2ecc71' };
};
const getSpO2Status = (spo2: string) => {
    const value = parseFloat(spo2);
    if (isNaN(value)) return { status: 'N/A', color: '#7f8c8d' };
    if (value < 95) return { status: 'Low', color: '#e74c3c' };
    return { status: 'Normal', color: '#2ecc71' };
};
interface UserData {
    name: string;
    age: number;
    userType: 'doctor' | 'patient';
}

type ReportScreenProps = {
    navigation: StackNavigationProp<RootStackParamList, 'ReportScreen'>;
};

const ReportScreen: React.FC<ReportScreenProps> = ({ navigation }) => {
    const route = useRoute();
    const [userData, setUserData] = useState<UserData | null>(null);
    const db = getFirestore(app);
    const { userType } = route.params as { userType: 'doctor' | 'patient' };
    const [client, setClient] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [report, setReport] = useState<any>(null);
    const [patientInfo, setPatientInfo] = useState({
        name: userData?.name,
        age: userData?.age,
        email: auth.currentUser?.email || "user@example.com"
    });

    // Data collection refs
    const ecgData = useRef<number[]>([]);
    const tempData = useRef<number[]>([]);
    const hrData = useRef<number[]>([]);
    const spo2Data = useRef<number[]>([]);
    const emgData = useRef<number[]>([]);

    // Initialize MQTT client
    useEffect(() => {
        const clientId = `report-client-${Date.now()}`;

        const fetchUserData = async () => {
            const user = auth.currentUser;
            if (user) {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setUserData(docSnap.data() as UserData);
                }
            }
        };

        MQTT.createClient({
            uri: MQTT_BROKER_URL,
            clientId,
            auth: true,
            user: 'thepavanpatil',
            pass: 'Patil@1234',
        }).then((mqttClient) => {
            mqttClient.on("connect", () => {
                TOPICS.forEach(topic => mqttClient.subscribe(topic, 0));
            });

            mqttClient.on("message", (msg) => {
                const value = msg.data.toString();

                switch (msg.topic) {
                    case "sensor/ecg":
                        ecgData.current.push(parseFloat(value) || 0);
                        break;
                    case "sensor/temp":
                        tempData.current.push(parseFloat(value) || 0);
                        break;
                    case "sensor/health":
                        const [hr, spo2] = value.split(",");
                        hrData.current.push(parseFloat(hr.split(":")[1] || "0"));
                        spo2Data.current.push(parseFloat(spo2.split(":")[1] || "0"));
                        break;
                    case "sensor/emg":
                        emgData.current.push(parseFloat(value) || 0);
                        break;
                }
            });
            fetchUserData();
            mqttClient.connect();
            setClient(mqttClient);
        });

        return () => client?.disconnect();
    }, []);

    const handleSignOut = async () => {
        try {
            await client?.disconnect();
            await auth.signOut();
            navigation.navigate('LoginScreens');
        } catch (error) {
            Alert.alert("Error", "Failed to sign out");
        }
    };
   

    const generateReport = async () => {
        if (!client) return;

        setIsGenerating(true);
        setReport(null);

        // Clear previous data
        ecgData.current = [];
        tempData.current = [];
        hrData.current = [];
        spo2Data.current = [];
        emgData.current = [];

        // Start ECG collection for 1 minute
        client.publish(COMMAND_TOPIC, "ecg", 0, false);
        await new Promise(resolve => setTimeout(resolve, 60000));
        client.publish(COMMAND_TOPIC, "stop", 0, false);

        // Start Temp collection for 30 seconds
        client.publish(COMMAND_TOPIC, "temp", 0, false);
        await new Promise(resolve => setTimeout(resolve, 30000));
        client.publish(COMMAND_TOPIC, "stop", 0, false);

        // Start Health collection (100 samples ~20 seconds at 5Hz)
        client.publish(COMMAND_TOPIC, "health", 0, false);
        await new Promise(resolve => setTimeout(resolve, 20000));
        client.publish(COMMAND_TOPIC, "stop", 0, false);

        // Start EMG collection for 1 minute
        client.publish(COMMAND_TOPIC, "emg", 0, false);
        await new Promise(resolve => setTimeout(resolve, 60000));
        client.publish(COMMAND_TOPIC, "stop", 0, false);

        // Process collected data
        const timestamp = new Date().toLocaleString();

        // Calculate averages
        const calculateStats = (data: number[]) => ({
            avg: data.reduce((a, b) => a + b, 0) / data.length || 0,
            max: Math.max(...data),
            min: Math.min(...data)
        });

        const ecgStats = calculateStats(ecgData.current);
        const tempStats = calculateStats(tempData.current);
        const hrStats = calculateStats(hrData.current);
        const spo2Stats = calculateStats(spo2Data.current);
        const emgStats = calculateStats(emgData.current);

        // Generate health assessment
        const getAssessment = () => {
            let issues = [];

            if (tempStats.avg >= 38) issues.push("Fever detected due to high temperature");
            if (tempStats.avg < 35) issues.push("Hypothermia detected due to low temperature");
            if (hrStats.avg < 60) issues.push("Bradycardia (low heart rate)");
            if (hrStats.avg > 100) issues.push("Tachycardia (high heart rate)");
            if (spo2Stats.avg < 95) issues.push("Low oxygen saturation");

            return issues.length > 0
                ? issues.join(", ")
                : "All parameters within normal range";
        };

        setReport({
            timestamp,
            patientInfo,
            ecg: ecgStats,
            temperature: tempStats,
            heartRate: hrStats,
            spO2: spo2Stats,
            emg: emgStats,
            assessment: getAssessment()
        });

        setIsGenerating(false);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Comprehensive Health Report</Text>

            {userData && userData.name && (
                <View style={styles.userInfo}>
                    <View style={styles.userHeader}>
                        <Icon name="user-md" size={24} color="#3498db" />
                        <Text style={styles.userName}>{userData.name}</Text>
                    </View>
                    <View style={styles.userDetails}>
                        <View style={styles.detailItem}>
                            <Icon name="calendar" size={16} color="#7f8c8d" />
                            <Text style={styles.detailText}>{userData.age} years</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Icon name="stethoscope" size={16} color="#7f8c8d" />
                            <Text style={styles.detailText}>{userData.userType}</Text>
                        </View>
                    </View>
                    
                </View>
            )}
            
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                    style={styles.generateButton}
                    onPress={generateReport}
                    disabled={isGenerating}
                >
                    <Icon
                        name="file-text"
                        size={20}
                        color="white"
                        style={styles.buttonIcon}
                    />
                    <Text style={styles.buttonText}>
                        {isGenerating ? "Collecting Data..." : "Generate Full Report"}
                    </Text>
                </TouchableOpacity>

                {report && (
                    <View style={styles.reportContainer}>
                        <Text style={styles.reportTimestamp}>
                            <Icon name="clock-o" size={12} /> {report.timestamp}
                        </Text>

                        {/* ECG Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Icon name="heartbeat" size={18} color="#e74c3c" />
                                <Text style={styles.sectionTitle}>Cardiac Analysis</Text>
                            </View>
                            <View style={styles.statsGrid}>
                                <StatItem label="Avg ECG" value={`${report.ecg.avg.toFixed(2)} mV`} />
                                <StatItem label="Peak ECG" value={`${report.ecg.max.toFixed(2)} mV`} />
                                <StatItem label="Low ECG" value={`${report.ecg.min.toFixed(2)} mV`} />
                            </View>
                        </View>

                        {/* Temperature Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Icon name="thermometer-half" size={18} color="#e67e22" />
                                <Text style={styles.sectionTitle}>Body Temperature</Text>
                            </View>
                            <View style={styles.statsGrid}>
                                <StatItem label="Average" value={`${report.temperature.avg.toFixed(2)}°C`} />
                                <StatItem label="Maximum" value={`${report.temperature.max.toFixed(2)}°C`} />
                                <StatItem label="Minimum" value={`${report.temperature.min.toFixed(2)}°C`} />
                            </View>
                        </View>

                        {/* Vitals Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Icon name="heart-o" size={18} color="#2ecc71" />
                                <Text style={styles.sectionTitle}>Vital Signs</Text>
                            </View>
                            <View style={styles.statsGrid}>
                                <StatItem
                                    label="Heart Rate"
                                    value={`${report.heartRate.avg.toFixed(0)} BPM`}
                                    status={getHeartRateStatus(report.heartRate.avg.toString())}
                                />
                                <StatItem
                                    label="SpO₂"
                                    value={`${report.spO2.avg.toFixed(0)}%`}
                                    status={getSpO2Status(report.spO2.avg.toString())}
                                />
                            </View>
                        </View>

                        {/* EMG Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Icon name="bolt" size={18} color="#9b59b6" />
                                <Text style={styles.sectionTitle}>Muscle Activity</Text>
                            </View>
                            <View style={styles.statsGrid}>
                                <StatItem label="Avg EMG" value={`${report.emg.avg.toFixed(2)} mV`} />
                                <StatItem label="Peak EMG" value={`${report.emg.max.toFixed(2)} mV`} />
                                <StatItem label="Low EMG" value={`${report.emg.min.toFixed(2)} mV`} />
                            </View>
                        </View>

                        {/* Assessment */}
                        <View style={styles.assessment}>
                            <Text style={styles.assessmentTitle}>
                                <Icon name="commenting" size={16} /> Medical Assessment
                            </Text>
                            <Text style={styles.assessmentText}>{report.assessment}</Text>
                        </View>
                        
                    </View>


                )}
            </ScrollView>
        </View>
    );
};
const styles = StyleSheet.create({
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e74c3c',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 6,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },

    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    header: {
        fontSize: 26,
        fontWeight: '800',
        color: '#2c3e50',
        marginBottom: 25,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    userInfo: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 18,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        elevation: 2,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    userName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#2c3e50',
        marginLeft: 10,
    },
    userDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    detailText: {
        fontSize: 14,
        color: '#7f8c8d',
        marginLeft: 8,
    },
    signOutText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 12,
    },
    generateButton: {
        backgroundColor: '#3498db',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#3498db',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    buttonIcon: {
        marginRight: 12,
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    reportContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 18,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        elevation: 2,
    },
    reportTimestamp: {
        fontSize: 12,
        color: '#95a5a6',
        marginBottom: 20,
        textAlign: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        marginBottom: 24,
        paddingBottom: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2c3e50',
        marginLeft: 10,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    statItem: {
        width: '48%',
        marginBottom: 15,
    },
    statLabel: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 4,
    },
    statValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    assessment: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginTop: 10,
    },
    assessmentTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#e74c3c',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    assessmentText: {
        fontSize: 14,
        color: '#2c3e50',
        lineHeight: 20,
    },
    scrollContainer: {
        flexGrow: 1,
        padding: 1,
    },
});

export default ReportScreen;