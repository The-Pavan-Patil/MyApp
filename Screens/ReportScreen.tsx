import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ShareOptions, Platform, ActivityIndicator, TextInput } from 'react-native';
import MQTT from 'sp-react-native-mqtt';
import { useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { StackNavigationProp } from '@react-navigation/stack';
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app, auth } from '../firebase';
import Icon from 'react-native-vector-icons/FontAwesome';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { file, options } from 'pdfkit';
import Config from 'react-native-config';
import { GoogleGenerativeAI } from '@google/generative-ai';


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

//

const ReportScreen: React.FC<ReportScreenProps> = ({ navigation }) => {
    const genAI = new GoogleGenerativeAI("AIzaSyCyb8Qu9zh4wPbb7crKBTwqq4UE9etUoyQ");
    const route = useRoute();
    const [userData, setUserData] = useState<UserData | null>(null);
    const db = getFirestore(app);
    const { userType } = route.params as { userType: 'doctor' | 'patient' };
    const [client, setClient] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [report, setReport] = useState<any>(null);
    const [currentCollecting, setCurrentCollecting] = useState<string | null>(null);
    const [patientInfo, setPatientInfo] = useState({
        name: userData?.name,
        age: userData?.age,
        email: auth.currentUser?.email || "user@example.com"
    });
    const [symptomDescription, setSymptomDescription] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

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

    const hexToRgb = (hex: string): [number, number, number] => {
        const bigint = parseInt(hex.replace('#', ''), 16);
        return [
            ((bigint >> 16) & 255) / 255,
            ((bigint >> 8) & 255) / 255,
            (bigint & 255) / 255
        ];
    };

    const getInstructions = (sensor: string) => {
        switch (sensor) {
            case 'ecg':
                return 'Please remain still and avoid movement to ensure accurate ECG readings.';
            case 'temp':
                return 'Keep the temperature sensor in contact with your skin.';
            case 'health':
                return 'Keep the finger on the sensor for heart rate and SpO₂ measurement.';
            case 'emg':
                return 'Move the Muscle you want to measure and relax it between measurements.';
            default:
                return '';
        }
    };

    const generatePDF = async () => {
        if (!report) return;

        try {
            const html = `
<html>
  <head>
    <style>
      /* Professional Medical Report Styles */
      @page { margin: 50px 40px; }
      body { 
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        color: #333;
      }
      .header {
        border-bottom: 2px solid #3498db;
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      .clinic-info {
        text-align: center;
        margin-bottom: 25px;
      }
      .clinic-name {
        font-size: 24px;
        color: #2c3e50;
        font-weight: bold;
        margin-bottom: 5px;
      }
      .patient-info {
        margin-bottom: 30px;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
      }
      .section-title {
        color: #3498db;
        font-size: 18px;
        font-weight: bold;
        margin: 25px 0 15px;
        border-bottom: 1px solid #ecf0f1;
        padding-bottom: 8px;
      }
      .vital-table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
      }
      .vital-table th {
        background: #3498db;
        color: white;
        padding: 12px;
        text-align: left;
      }
      .vital-table td {
        padding: 12px;
        border-bottom: 1px solid #ecf0f1;
      }
      .vital-table tr:nth-child(even) {
        background-color: #f8f9fa;
      }
      .critical-value {
        color: #e74c3c;
        font-weight: bold;
      }
      .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #ecf0f1;
        font-size: 12px;
        color: #95a5a6;
      }
      .signature-box {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px dashed #ccc;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="clinic-info">
        <div class="clinic-name">Vita-Link Diagnostics</div>
      </div>
      
      <div class="patient-info">
        <h3>Patient Information</h3>
        <table>
          <tr>
            <td width="200"><strong>Name:</strong> ${userData?.name}</td>
            <td><strong>Age:</strong> ${userData?.age}</td>
          </tr>
          <tr>
            <td><strong>Report Date:</strong> ${report.timestamp}</td>
            <td><strong>Report ID:</strong> CC-${Math.floor(100000 + Math.random() * 900000)}</td>
          </tr>
        </table>
      </div>
    </div>
    <div class="section">
  <div class="section-title">Reported Symptoms</div>
  <div style="padding: 15px; background: #fff9eb; border-radius: 8px;">
    <p>${report.symptoms || 'No symptoms reported'}</p>
  </div>
</div>

    <!-- Cardiac Analysis -->
    <div class="section">
      <div class="section-title">Cardiac Analysis</div>
      <table class="vital-table">
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Normal Range</th>
        </tr>
        <tr>
          <td>Average ECG</td>
          <td>${report.ecg.avg.toFixed(2)} mV</td>
          <td>0.5-2.5 mV</td>
        </tr>
        <tr>
          <td>Peak ECG</td>
          <td>${report.ecg.max.toFixed(2)} mV</td>
          <td>&lt; 3.0 mV</td>
        </tr>
        <tr>
          <td>Minimum ECG</td>
          <td>${report.ecg.min.toFixed(2)} mV</td>
          <td>&gt; 0.1 mV</td>
        </tr>
      </table>
    </div>

    <!-- Body Temperature -->
    <div class="section">
      <div class="section-title">Body Temperature Analysis</div>
      <table class="vital-table">
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Status</th>
        </tr>
        <tr>
          <td>Temperature</td>
          <td>${report.temperature.avg.toFixed(2)}°C</td>
          <td>${report.temperature.avg >= 38 ? '<span class="critical-value">Fever</span>' : 'Normal'}</td>
        </tr>
      </table>
    </div>

    <!-- Vital Signs -->
    <div class="section">
      <div class="section-title">Vital Signs</div>
      <table class="vital-table">
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Normal Range</th>
        </tr>
        <tr>
          <td>Heart Rate</td>
          <td>${report.heartRate.avg.toFixed(0)} BPM</td>
          <td>60-100 BPM</td>
        </tr>
        <tr>
          <td>SpO₂</td>
          <td>${report.spO2.avg.toFixed(0)}%</td>
          <td>95-100%</td>
        </tr>
      </table>
    </div>

    <!-- Medical Assessment -->
    <div class="section">
      <div class="section-title">Vita-Link Assessment</div>
      <div style="padding: 15px; background: #fff9eb; border-radius: 8px;">
        <p>${report.assessment}</p>
      </div>
    </div>
    

    <!-- Footer -->
    <div class="footer">
      <p>Generated by Vitalink Application</p>
    </div>
  </body>
</html>
`;
            const pdfResult = await RNHTMLtoPDF.convert({
                html,
                fileName: 'health_report',
                directory: 'Documents',
            });


            const pdfOptions = {
                html,
                fileName: 'health_report',
                directory: 'Documents',
            };

            const baseOptions = {
                subject: 'Health Report PDF',
                dialogTitle: 'Save Health Report',
            };

            const iosOptions = {
                ...baseOptions,
                url: `file://${pdfResult.filePath}`,
                saveToFiles: true,
            };

            const androidOptions = {
                ...baseOptions,
                urls: [`file://${pdfResult.filePath}`],
            };


            await Share.open(Platform.OS === 'ios' ? iosOptions : androidOptions);
        } catch (error) {
            Alert.alert('Error', 'Failed to generate PDF');
        }
    };

    const getGeminiAssessment = async (sensorData: any, symptoms: string) => {
        setIsGeneratingAI(true);
        try {
          if (!sensorData || !sensorData.ecg || !sensorData.temp) {
            throw new Error('Incomplete sensor data');
          }
      
          const model = genAI.getGenerativeModel({ model:  "gemini-2.5-pro-exp-03-25" });
          
          const prompt = `As a medical professional, analyze this patient data:
            
      Patient Symptoms: ${symptoms || 'None reported'}
      
      Sensor Data:
      - ECG: Avg ${sensorData.ecg.avg.toFixed(2)} mV
      - Temperature: ${sensorData.temp.avg.toFixed(2)}°C
      - Heart Rate: ${sensorData.hr.avg.toFixed(0)} BPM
      - SpO2: ${sensorData.spo2.avg.toFixed(0)}%
      - EMG: ${sensorData.emg.avg.toFixed(2)} mV
      
      Provide a Ai Analysis with:
      1. Diagnosis based on symptoms (give warning if the sensor data is not correct)
      2. Recommended actions
      3. No bold text
      3. Plain text only 
      Use clear, non-technical language.`;
      
          const result = await model.generateContent(prompt);
          const response = await result.response;
          return response.text();
        } catch (error) {
          console.error('Gemini Error:', error);
          return `AI Analysis unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`;
        } finally {
          setIsGeneratingAI(false);
        }
      };



    const handleSignOut = async () => {
        try {
            if (client?.isConnected()) {
                client.publish('stop');
            }
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



        try {
            // ECG Collection
            client.publish(COMMAND_TOPIC, "ecg", 0, false);
            setCurrentCollecting('ecg');
            await new Promise(resolve => setTimeout(resolve, 15000));
            client.publish(COMMAND_TOPIC, "stop", 0, false);
            setCurrentCollecting(null);

            // Temperature Collection
            client.publish(COMMAND_TOPIC, "temp", 0, false);
            setCurrentCollecting('temp');
            await new Promise(resolve => setTimeout(resolve, 15000));
            client.publish(COMMAND_TOPIC, "stop", 0, false);
            setCurrentCollecting(null);

            // Health Data Collection
            client.publish(COMMAND_TOPIC, "health", 0, false);
            setCurrentCollecting('health');
            await new Promise(resolve => setTimeout(resolve, 15000));
            client.publish(COMMAND_TOPIC, "stop", 0, false);
            setCurrentCollecting(null);

            // EMG Collection
            client.publish(COMMAND_TOPIC, "emg", 0, false);
            setCurrentCollecting('emg');
            await new Promise(resolve => setTimeout(resolve, 15000));
            client.publish(COMMAND_TOPIC, "stop", 0, false);
            setCurrentCollecting(null);

            // Process data and generate report...
            // ... existing report generation code

        } catch (error) {
            Alert.alert('Error', 'Data collection failed');
            setCurrentCollecting(null);
            setIsGenerating(false);
        }

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
        try {
            const aiAssessment = await getGeminiAssessment({
              ecg: ecgStats,
              temp: tempStats,
              hr: hrStats,
              spo2: spo2Stats,
              emg: emgStats
            }, symptomDescription);
        
            console.log('AI Assessment:', aiAssessment); // Add this line
        
            setReport({
              timestamp,
              patientInfo,
              ecg: ecgStats,
              temperature: tempStats,
              heartRate: hrStats,
              spO2: spo2Stats,
              emg: emgStats,
              assessment: aiAssessment, 
              symptoms: symptomDescription
            });
          } catch (error) {
            console.error('Report Generation Error:', error);
            Alert.alert('Error', 'Failed to generate report');
          }
          
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
            <TextInput
                style={styles.symptomInput}
                placeholder="Describe any symptoms or health concerns..."
                placeholderTextColor="#95a5a6"
                multiline
                numberOfLines={3}
                value={symptomDescription}
                onChangeText={setSymptomDescription}
            />
            {isGeneratingAI && (
                <View style={styles.aiLoading}>
                    <ActivityIndicator size="small" color="#3498db" />
                    <Text style={styles.aiLoadingText}>Generating AI Analysis...</Text>
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
                {currentCollecting && (
                    <View style={styles.collectingContainer}>
                        <ActivityIndicator size="small" color="#3498db" />
                        <Text style={styles.collectingText}>
                            Collecting {currentCollecting.toUpperCase()} data...
                        </Text>
                        <Text style={styles.instructionText}>
                            {getInstructions(currentCollecting)}
                        </Text>
                    </View>
                )}


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
                        <TouchableOpacity
                            style={styles.downloadButton}
                            onPress={generatePDF}
                        >
                            <Icon
                                name="download"
                                size={20}
                                color="white"
                                style={styles.buttonIcon}
                            />
                            <Text style={styles.buttonText}>Download PDF Report</Text>
                        </TouchableOpacity>

                    </View>


                )}
                <TouchableOpacity
                    style={styles.signout}
                    onPress={handleSignOut}
                >

                    <Text style={styles.buttonText}>Sign Out</Text>
                </TouchableOpacity>
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
    signout: {
        backgroundColor: 'red',
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
    downloadButton: {
        backgroundColor: '#27ae60',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#27ae60',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    collectingContainer: {
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
        padding: 16,
        marginVertical: 10,
        alignItems: 'center',
    },
    collectingText: {
        color: '#1976d2',
        fontWeight: '500',
        marginTop: 8,
        marginBottom: 4,
    },
    instructionText: {
        color: '#424242',
        fontSize: 14,
        textAlign: 'center',
    },
    symptomInput: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        minHeight: 100,
        textAlignVertical: 'top',
        fontSize: 14,
        color: '#2c3e50',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        elevation: 2,
    },
    aiLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
        marginBottom: 10,
    },
    aiLoadingText: {
        color: '#1976d2',
        marginLeft: 10,
        fontSize: 14,
    },
});

export default ReportScreen; 