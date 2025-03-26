// Create a new file ReportScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MQTT from 'sp-react-native-mqtt';
import { auth } from '../firebase';
import { useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { StackNavigationProp } from '@react-navigation/stack';

const MQTT_BROKER_URL = "wss://89db5cc86dc341a691af602183793358.s1.eu.hivemq.cloud:8883";
const COMMAND_TOPIC = "sensor/command";
const TOPICS = ["sensor/ecg", "sensor/temp", "sensor/health", "sensor/emg"];


type ReportScreenProps = {
    navigation: StackNavigationProp<RootStackParamList,'ReportScreen'>;
  };

const ReportScreen: React.FC<ReportScreenProps> = ({ navigation }) => {
  const route = useRoute();
  const { userType } = route.params as { userType: 'doctor' | 'patient' };
  const [client, setClient] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [patientInfo, setPatientInfo] = useState({
    name: "John Doe",
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
        
        switch(msg.topic) {
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

      mqttClient.connect();
      setClient(mqttClient);
    });

    return () => client?.disconnect();
  }, []);

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
      
      if (tempStats.avg >= 38) issues.push("Fever detected");
      if (tempStats.avg < 35) issues.push("Hypothermia detected");
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
      
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>{patientInfo.name}</Text>
        <Text style={styles.patientEmail}>{patientInfo.email}</Text>
      </View>

      <TouchableOpacity
        style={styles.generateButton}
        onPress={generateReport}
        disabled={isGenerating}
      >
        <Text style={styles.buttonText}>
          {isGenerating ? "Collecting Data..." : "Generate Full Report"}
        </Text>
      </TouchableOpacity>

      {report && (
        <View style={styles.reportContainer}>
          <Text style={styles.reportTimestamp}>Report generated: {report.timestamp}</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ECG Analysis</Text>
            <Text>Average: {report.ecg.avg.toFixed(2)} mV</Text>
            <Text>Max: {report.ecg.max.toFixed(2)} mV</Text>
            <Text>Min: {report.ecg.min.toFixed(2)} mV</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Temperature</Text>
            <Text>Average: {report.temperature.avg.toFixed(2)} °C</Text>
            <Text>Max: {report.temperature.max.toFixed(2)} °C</Text>
            <Text>Min: {report.temperature.min.toFixed(2)} °C</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vital Signs</Text>
            <Text>Heart Rate: {report.heartRate.avg.toFixed(0)} BPM</Text>
            <Text>SpO2: {report.spO2.avg.toFixed(0)}%</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EMG Analysis</Text>
            <Text>Average: {report.emg.avg.toFixed(2)} mV</Text>
            <Text>Max: {report.emg.max.toFixed(2)} mV</Text>
            <Text>Min: {report.emg.min.toFixed(2)} mV</Text>
          </View>

          <View style={styles.assessment}>
            <Text style={styles.assessmentTitle}>Medical Assessment:</Text>
            <Text style={styles.assessmentText}>{report.assessment}</Text>
          </View>
        </View>
      )}
    </View>
  );
};
const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: '#f5f9fc',
    },
    header: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#2c3e50',
      marginBottom: 20,
      textAlign: 'center',
    },
    patientInfo: {
      marginBottom: 20,
      alignItems: 'center',
    },
    patientName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#3498db',
    },
    patientEmail: {
      fontSize: 14,
      color: '#7f8c8d',
    },
    generateButton: {
      backgroundColor: '#27ae60',
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 20,
    },
    buttonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16,
    },
    reportContainer: {
      backgroundColor: 'white',
      borderRadius: 10,
      padding: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    reportTimestamp: {
      fontSize: 12,
      color: '#7f8c8d',
      marginBottom: 15,
      textAlign: 'center',
    },
    section: {
      marginBottom: 15,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: '#ecf0f1',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#2c3e50',
      marginBottom: 5,
    },
    assessment: {
      marginTop: 15,
      padding: 10,
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
    },
    assessmentTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#e74c3c',
      marginBottom: 5,
    },
    assessmentText: {
      fontSize: 14,
      color: '#2c3e50',
    },
  });
  
  export default ReportScreen;