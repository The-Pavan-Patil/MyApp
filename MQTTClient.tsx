import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from "react-native";
import MQTT from "sp-react-native-mqtt";
import { LineChart } from "react-native-chart-kit";
import { auth } from "./firebase";
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from './App';



//for data collection





type MQTTClientProps = {
    navigation: StackNavigationProp<RootStackParamList, 'MQTTClient'>;
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
      "Note: if you found any abnormility in the ECG signal please consult the doctor",  
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
    ]
  }, 
  emg: {
    title: "EMG Monitoring",
    description: "Electromyography measures muscle electrical activity",
    parameters: [
    "Try to move the muscle to see the effect on the EMG signal",
    "Any fluctuation in the EMG signal may indicate muscles are active",]
      
  }
};


//Main  state component




const MQTTClient:React.FC<MQTTClientProps> = ({ navigation }) => {
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [showReport, setShowReport] = useState(false);
    const [collectionInterval, setCollectionInterval] = useState<NodeJS.Timeout|null>(null);
    const [collectedData, setCollectedData] = useState<{
  ecg: number[];
  temp: number[];
  health: { heartRate: number[]; spO2: number[] };
  emg: number[];
}>({
  ecg: [],
  temp: [],
  health: { heartRate: [], spO2: [] },
  emg: []
});

    const handleSignOut = async () => {
        try {
          await client?.disconnect();
          await auth.signOut();
          navigation.navigate('LoginScreen');
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
    return () => {
      if (collectionInterval) {
        clearInterval(collectionInterval);
      }
      if (client) {
        client.disconnect();
      }
    };
  }, [client, collectionInterval]);
  useEffect(() => {
    const clientId = `app-client-${Date.now()}`;
  
    const initializeMQTT = async () => {
      try {
        const mqttClient = await MQTT.createClient({
          uri: MQTT_BROKER_URL,
          clientId,
          auth: true,
          user: 'thepavanpatil',
          pass: 'Patil@1234',
        });
  
        mqttClient.on("connect", () => {
          console.log("MQTT Connected");
          TOPICS.forEach(topic => {
            mqttClient.subscribe(topic, 0);
            console.log(`Subscribed to ${topic}`);
          });
        });

        mqttClient.on("message", (msg) => {
          const value = msg.data.toString();
          console.log(`Message received on ${msg.topic}`);
          // Add data collection logic
          if (isGeneratingReport) {
            switch(msg.topic) {
              case "sensor/ecg":
                setCollectedData(prev => ({
                  ...prev,
                  ecg: [...prev.ecg, parseSafeFloat(value)]
                }));
                break;
              case "sensor/temp":
                setCollectedData(prev => ({
                  ...prev,
                  temp: [...prev.temp, parseSafeFloat(value)]
                }));
                break;
              case "sensor/health":
                const [hr, spo2] = value.split(",");
                setCollectedData(prev => ({
                  ...prev,
                  health: {
                    heartRate: [...prev.health.heartRate, parseSafeFloat(hr.split(":")[1] || "0")],
                    spO2: [...prev.health.spO2, parseSafeFloat(spo2.split(":")[1] || "0")]
                  }
                }));
                break;
              case "sensor/emg":
                setCollectedData(prev => ({
                  ...prev,
                  emg: [...prev.emg, parseSafeFloat(value)]
                }));
                break;
            }
            switch(msg.topic) {
              case "sensor/ecg":
                ecgData.current = [
                  ...ecgData.current.slice(-MAX_DATA_POINTS + 1), 
                  parseSafeFloat(value)
                ];
                setSensorData(prev => ({...prev, ecg: [...ecgData.current]}));
                break;
                
              case "sensor/temp":
                setSensorData(prev => ({...prev, temp: `${value}°C`}));
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
                  parseSafeFloat(value)
                ];
                setSensorData(prev => ({...prev, emg: [...emgData.current]}));
                break;
            }
          }
        });

        mqttClient.on("error", (error) => {
          console.error("MQTT Error:", error);
        });
        
        await mqttClient.connect();
        setClient(mqttClient);
      } catch (error) {
        console.error("MQTT Initialization Error:", error);
        Alert.alert("Connection Error", "Failed to connect to MQTT broker");
      }
    };

    initializeMQTT();

    return () => {
      if (client) {
        client.disconnect();
        console.log("MQTT Disconnected");
      }
    };
}, [client, isGeneratingReport]); 

  const sendCommand = (command: string) => {
    if (client?.isConnected()) {
      client.publish(COMMAND_TOPIC, command, 0, false);
      setCurrentMode(command === "stop" ? "none" : command);
    }
  };
  const startDataCollection = () => {
    if (!client) return;
  
    // Clear previous data and reset mode
    setCollectedData({
      ecg: [],
      temp: [],
      health: { heartRate: [], spO2: [] },
      emg: []
    });
    setCurrentMode("none"); // Reset current mode
    setShowReport(false);
    
    setIsGeneratingReport(true);
    
    // Cycle through modes every 5 seconds
    const modes = ["ecg", "temp", "health", "emg"];
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (currentIndex >= modes.length) {
        clearInterval(interval);
        generateFinalReport();
        setIsGeneratingReport(false);
        sendCommand("stop");
        setCurrentMode("none"); // Ensure mode is reset after completion
        return;
      }
      
      sendCommand(modes[currentIndex]);
      currentIndex++;
    }, 5000);
  
    setCollectionInterval(interval);
  };
  
  // Add this function to generate the report
  const generateFinalReport = () => {
    // Calculate averages
    
    const ecgAvg = collectedData.ecg.reduce((a, b) => a + b, 0) / collectedData.ecg.length || 0;
    const tempAvg = collectedData.temp.reduce((a, b) => a + b, 0) / collectedData.temp.length || 0;
    const hrAvg = collectedData.health.heartRate.reduce((a, b) => a + b, 0) / collectedData.health.heartRate.length || 0;
    const spO2Avg = collectedData.health.spO2.reduce((a, b) => a + b, 0) / collectedData.health.spO2.length || 0;
    const emgAvg = collectedData.emg.reduce((a, b) => a + b, 0) / collectedData.emg.length || 0;
    const tempStatus = getTemperatureStatus(tempAvg.toFixed(2));
    const hrStatus = getHeartRateStatus(hrAvg.toFixed(0));
    const spO2Status = getSpO2Status(spO2Avg.toFixed(0));
    
    // Create report object
    const report = {
    timestamp: new Date().toLocaleString(),
    patientEmail: auth.currentUser?.email || "Not available",
    ecg: {
      average: ecgAvg.toFixed(2),
      max: Math.max(...collectedData.ecg).toFixed(2),
      min: Math.min(...collectedData.ecg).toFixed(2)
    },
    temperature: {
      average: tempAvg.toFixed(2),
      unit: "°C",
      status: tempStatus.status,
      color: tempStatus.color
    },
    heartRate: {
      average: hrAvg.toFixed(0),
      unit: "BPM",
      status: hrStatus.status,
      color: hrStatus.color
    },
    spO2: {
      average: spO2Avg.toFixed(0),
      unit: "%",
      status: spO2Status.status,
      color: spO2Status.color
    },
    emg: {
      average: emgAvg.toFixed(2),
      max: Math.max(...collectedData.emg).toFixed(2),
      min: Math.min(...collectedData.emg).toFixed(2)
    }
  };

  
    setReportData(report);
    setShowReport(true);
  };


  //Helper function to send command to the device
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
        <Text style={styles.header}>Vital Link</Text>
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
    onPress={() => sendCommand("stop")}
  >
    <Text style={styles.buttonText}>Stop</Text>
  </TouchableOpacity>
  <TouchableOpacity
  style={[styles.button, styles.reportButton]}
  onPress={startDataCollection}
  disabled={isGeneratingReport}
>
  <Text style={styles.buttonText}>
    {isGeneratingReport ? "Generating..." : "Generate Report"}
  </Text>
</TouchableOpacity>

</View>

{showReport && reportData && (
  <View style={styles.reportContainer}>
  <View style={styles.reportHeaderContainer}>
    <Text style={styles.reportHeader}>Health Report</Text>
    <Text style={styles.patientEmail}>{reportData.patientEmail}</Text>
  </View>
  <View style={styles.reportSection}>
      <Text style={styles.reportTitle}>ECG Analysis</Text>
      <Text>Average: {reportData.ecg.average} mV</Text>
      <Text>Max: {reportData.ecg.max} mV</Text>
      <Text>Min: {reportData.ecg.min} mV</Text>
    </View>

  <Text style={styles.reportTimestamp}>{reportData.timestamp}</Text>
  <View style={styles.reportSection}>
      <Text style={styles.reportTitle}>Temperature</Text>
      <View style={styles.reportRow}>
        <Text>Average: {reportData.temperature.average} °C</Text>
        <View style={[styles.reportStatus, { 
          backgroundColor: reportData.temperature.color 
        }]}>
          <Text style={styles.reportStatusText}>
            {reportData.temperature.status}
          </Text>
        </View>
      </View>
    </View>

    <View style={styles.reportSection}>
      <Text style={styles.reportTitle}>Vital Signs</Text>
      <View style={styles.reportRow}>
        <Text>Heart Rate: {reportData.heartRate.average} BPM</Text>
        <View style={[styles.reportStatus, { 
          backgroundColor: reportData.heartRate.color 
        }]}>
          <Text style={styles.reportStatusText}>
            {reportData.heartRate.status}
          </Text>
        </View>
      </View>
      <View style={styles.reportRow}>
        <Text>SpO2: {reportData.spO2.average}%</Text>
        <View style={[styles.reportStatus, { 
          backgroundColor: reportData.spO2.color 
        }]}>
          <Text style={styles.reportStatusText}>
            {reportData.spO2.status}
          </Text>
        </View>
      </View>
      {parseFloat(reportData.spO2.average) < 95 && (
        <Text style={styles.reportNote}>
          Note: Consider supplemental oxygen
        </Text>
      )}
    </View>

    <View style={styles.reportSection}>
      <Text style={styles.reportTitle}>EMG Analysis</Text>
      <Text>Average: {reportData.emg.average} mV</Text>
      <Text>Max: {reportData.emg.max} mV</Text>
      <Text>Min: {reportData.emg.min} mV</Text>
    </View>
  </View>
)}

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
      {sensorData.health.spO2 !== "N/A" && 
        parseFloat(sensorData.health.spO2) < 95 && " - Consider supplemental oxygen"}
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

  reportButton: {
    backgroundColor: '#9b59b6',
    marginTop: 10,
  },
  reportContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 3,
  },
  reportHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  reportTimestamp: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  reportSection: {
    marginVertical: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498db',
    marginBottom: 4,
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
  reportHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  patientEmail: {
    fontSize: 12,
    color: '#3498db',
    fontStyle: 'italic',
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  reportStatus: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  reportStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  reportNote: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },


});

export default MQTTClient;