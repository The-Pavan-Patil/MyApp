import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from "react-native";
import MQTT from "sp-react-native-mqtt";
import { LineChart } from "react-native-chart-kit";
import { auth } from "../firebase";
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';

import { useRoute } from '@react-navigation/native';

type MQTTClientProps = {
  navigation: StackNavigationProp<RootStackParamList,'MQTTClient'>;
};



type ModeDisplayNames = {
  ecg: string;
  temp: string;
  health: string;
  emg: string;
};

const MQTT_BROKER_URL = "wss://89db5cc86dc341a691af602183793358.s1.eu.hivemq.cloud:8883";
const COMMAND_TOPIC = "sensor/command";
const TOPICS = ["sensor/ecg", "sensor/temp", "sensor/health", "sensor/emg"];
const MAX_DATA_POINTS = 50;


const modeInformation = {
  ecg: {
    title: "ECG Monitoring",
    description: "Electrocardiogram (ECG) measures the electrical activity of the heart. ",
    parameters: [
      "Normal HR: 60-100 BPM",
      "P-wave: <120ms",
      "QRS Complex: <110ms",
      "QT Interval: <440ms"
    ]
  },
  temp: {
    title: "Body Temperature",
    description: "Core body temperature measurement",
    parameters: [
      "Normal Range: 36.5°C - 37.5°C",
      "Hypothermia: <35°C",
      "Fever: >38°C",
      "Hyperpyrexia: >40°C"
    ]
  },
  health: {
    title: "Vital Signs",
    description: "Combined health metrics",
    parameters: [
      "SpO2 Normal: 95-100%",
      "Resting HR: 60-100 BPM",
      "Bradycardia : <60 BPM",
      "Tachycardia: >100 BPM"
    ]
  },
  emg: {
    title: "EMG Monitoring",
    description: "Electromyography measures muscle electrical activity",
    parameters: [
      "Try to move the muscle to see the effect on the EMG signal",
      "Any fluctuation in the EMG signal may indicate muscles are active"
    ]
  }
};


const MQTTClient: React.FC<MQTTClientProps> = ({ navigation }) => {

  const route = useRoute();
  const { userType } = route.params as { userType: 'doctor' | 'patient' }
  useEffect(() => {
    if (userType !== 'doctor') {
      navigation.replace('ReportScreen',{userType});
    }
  }, [userType]);

  const handleSignOut = async () => {
    try {
      await client?.disconnect();
      await auth.signOut();
      navigation.navigate('LoginScreens');
    } catch (error) {
      Alert.alert("Error", "Failed to sign out");
    }
  };



  const [client, setClient] = useState<any>(null);
  const [currentMode, setCurrentMode] = useState("none");
  const [sensorData, setSensorData] = useState({
    ecg: [] as number[],
    temp: "0",
    health: { heartRate: "0", spO2: "0" }, // Initialize with number-like strings
    emg: [] as number[],
  });

  const parseSafeFloat = (val: string) => {
    const num = parseFloat(val);
    return isFinite(num) ? num : 0; // Replace invalid numbers with 0
  };




  const ecgData = useRef<number[]>([]);
  const emgData = useRef<number[]>([]);

  

  useEffect(() => {
    const clientId = `app-client-${Date.now()}`;
  

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
            ecgData.current = [
              ...ecgData.current.slice(-MAX_DATA_POINTS + 1),
              parseSafeFloat(value) // Use safe parser
            ];
            setSensorData(prev => ({ ...prev, ecg: [...ecgData.current] }));
            break;

          case "sensor/temp":
            setSensorData(prev => ({ ...prev, temp: `${value}°C` }));
            break;

          case "sensor/health":
            const [hr, spo2] = value.split(",");
            setSensorData(prev => ({
              ...prev,
              health: {
                heartRate: hr.split(":")[1] || "N/A",
                spO2: spo2.split(":")[1] || "N/A"
              }
            }));
            break;

          case "sensor/emg":
            emgData.current = [
              ...emgData.current.slice(-MAX_DATA_POINTS + 1),
              parseSafeFloat(value) // Use safe parser
            ];
            setSensorData(prev => ({ ...prev, emg: [...emgData.current] }));
            break;
        }
      });

      mqttClient.connect();
      setClient(mqttClient);
    });

    return () => client?.disconnect();
  }, []);

  const goToReport = (command: string) => {
    if (client?.isConnected()) {
      client.publish(COMMAND_TOPIC, command, 0, false);
      setCurrentMode(command === "stop" ? "none" : command);
      navigation.navigate('ReportScreen',{userType})
    }
  };
  const sendCommand = (command: string) => {
    if (client?.isConnected()) {
      client.publish(COMMAND_TOPIC, command, 0, false);
      setCurrentMode(command === "stop" ? "none" : command);
    }
  };
  const getTemperatureStatus = (temp: string) => {
    const value = parseFloat(temp);
    if (isNaN(value)) return { status: 'N/A', color: '#7f8c8d' };
    if (value < 35) return { status: 'Hypothermia', color: '#e67e22' };
    if (value >= 38) return { status: 'Fever', color: '#e74c3c' };
    return { status: 'Normal', color: '#2ecc71' };
  };

  const getHeartRateStatus = (hr: string) => {
    const value = parseFloat(hr);
    if (isNaN(value)) return { status: 'N/A', color: '#7f8c8d' };
    if (value < 60) return { status: 'Bradycardia (Low)', color: '#e67e22' };
    if (value > 100) return { status: 'Tachycardia (High)', color: '#e74c3c' };
    return { status: 'Normal', color: '#2ecc71' };
  };

  const getSpO2Status = (spo2: string) => {
    const value = parseFloat(spo2);
    if (isNaN(value)) return { status: 'N/A', color: '#7f8c8d' };
    if (value < 95) return { status: 'Low Oxygen', color: '#e74c3c' };
    return { status: 'Normal', color: '#2ecc71' };
  };

  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,

    propsForDots: { r: "0" }, // Remove dots
    propsForBackgroundLines: { strokeWidth: 0 }, // Remove grid lines
    fromZero: true, // Ensure values start from 0

    color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    // propsForDots: {
    //   r: "2",
    //   strokeWidth: "1",
    //   stroke: "#2c3e50"
    // }
  };


  const renderChart = (data: number[], label: string) => {
    const validData = data.map(num =>
      Math.max(-10000, Math.min(10000, num)) // Clamp values between -10k and 10k
    );

    return (
      // Added missing return statement
      <LineChart
        data={{
          labels: [],
          datasets: [{ data: validData }]
        }}
        width={Dimensions.get("window").width - 32}
        height={220}
        chartConfig={chartConfig}
        bezier
        withHorizontalLabels={false}
        withVerticalLabels={false}
        withDots={false}

        withInnerLines={false}
        withOuterLines={false}
        withScrollableDot={false}
        style={{
          backgroundColor: "white",
          paddingRight: 0,
          paddingLeft: 0
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Vita-Link</Text>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >

          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>


      <View style={styles.buttonContainer}>
        {(["ecg", "temp", "health", "emg"] as (keyof ModeDisplayNames)[]).map((mode) => {
          const modeDisplayNames: ModeDisplayNames = {
            ecg: "ECG Monitor",
            temp: "Temperature",
            health: "HR/SpO2",
            emg: "EMG Scan"
          };

          return (
            <TouchableOpacity
              key={mode}
              style={[
                styles.button,
                currentMode === mode && styles.activeButton
              ]}
              onPress={() => sendCommand(mode)}
            >
              <Text style={styles.buttonText}>
                {modeDisplayNames[mode]}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.stopButton}
          onPress={() => goToReport("stop")}
        >
          <Text style={styles.buttonText}>Report</Text>
        </TouchableOpacity>
      </View>

      {currentMode === "ecg" && (
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>{modeInformation.ecg.title}</Text>
          {renderChart(sensorData.ecg, "ECG")}
          <View style={styles.infoContainer}>
            <Text style={styles.infoDescription}>{modeInformation.ecg.description}</Text>
            {modeInformation.ecg.parameters.map((param, index) => (
              <View key={index} style={styles.parameterItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.parameterText}>{param}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {currentMode === "emg" && (
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>{modeInformation.emg.title}</Text>
          {renderChart(sensorData.emg, "EMG")}
          <View style={styles.infoContainer}>
            <Text style={styles.infoDescription}>{modeInformation.emg.description}</Text>
            {modeInformation.emg.parameters.map((param, index) => (
              <View key={index} style={styles.parameterItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.parameterText}>{param}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {currentMode === "temp" && (
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>{modeInformation.temp.title}</Text>
          <View style={styles.tempContainer}>
            <Text style={styles.tempText}>{sensorData.temp}</Text>
            <View style={[styles.statusContainer, {
              backgroundColor: getTemperatureStatus(sensorData.temp).color
            }]}>
              <Text style={styles.statusText}>
                {getTemperatureStatus(sensorData.temp).status}
              </Text>
            </View>
          </View>
          <View style={styles.infoContainer}>
            <Text style={styles.infoDescription}>{modeInformation.temp.description}</Text>
            {modeInformation.temp.parameters.map((param, index) => (
              <View key={index} style={styles.parameterItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.parameterText}>{param}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {currentMode === "health" && (
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>{modeInformation.health.title}</Text>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Heart Rate:</Text>
            <View style={styles.vitalContainer}>
              <Text style={styles.healthValue}>{sensorData.health.heartRate} BPM</Text>
              <View style={[styles.statusIcon, {
                backgroundColor: getHeartRateStatus(sensorData.health.heartRate).color
              }]} />
            </View>
          </View>
          <View style={styles.healthStatus}>
            <Text style={styles.statusMessage}>
              {getHeartRateStatus(sensorData.health.heartRate).status}
            </Text>
          </View>

          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>SpO2:</Text>
            <View style={styles.vitalContainer}>
              <Text style={styles.healthValue}>{sensorData.health.spO2}%</Text>
              <View style={[styles.statusIcon, {
                backgroundColor: getSpO2Status(sensorData.health.spO2).color
              }]} />
            </View>
          </View>
          <View style={styles.healthStatus}>
            <Text style={styles.statusMessage}>
              {getSpO2Status(sensorData.health.spO2).status}
              {sensorData.health.spO2 !== "N/A" && parseFloat(sensorData.health.spO2) < 95 && " - Provide supplemental oxygen "}

            </Text>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoDescription}>{modeInformation.health.description}</Text>
            {modeInformation.health.parameters.map((param, index) => (
              <View key={index} style={styles.parameterItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.parameterText}>{param}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// Keep the same styles as previous version
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f9fc',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2c3e50',
    letterSpacing: 0.8,
  },
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
  signOutText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    gap: 6,
  },
  activeButton: {
    backgroundColor: '#27ae60',
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  stopButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  dataCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },
  chart: {
    flex: 1,
    height: Dimensions.get('window').height * 0.4,
  },
  tempText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 20,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  healthLabel: {
    fontSize: 18,
    color: '#7f8c8d',
  },
  healthValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  infoContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  infoDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 12,
  },
  parameterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bullet: {
    color: '#3498db',
    marginRight: 8,
  },
  parameterText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerButtonText: {
    color: '#e74c3c',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 14,
  },
  tempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  statusContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  vitalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  healthStatus: {
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  statusMessage: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
});
export default MQTTClient; 