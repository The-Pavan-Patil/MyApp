import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import MQTT from "sp-react-native-mqtt";
import { LineChart } from "react-native-chart-kit";

const MQTT_BROKER_URL = "wss://89db5cc86dc341a691af602183793358.s1.eu.hivemq.cloud:8883";
const COMMAND_TOPIC = "sensor/command";
const TOPICS = ["sensor/ecg", "sensor/temp", "sensor/health", "sensor/emg"];
const MAX_DATA_POINTS = 50;


const modeInformation = {
  ecg: {
    title: "ECG Monitoring",
    description: "Electrocardiogram (ECG) measures the electrical activity of the heart. Note: if you found any abnormility in the ECG signal please consult the doctor",
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
      "BP Normal: 120/80 mmHg"
    ]
  },
  emg: {
    title: "EMG Monitoring",
    description: "Electromyography measures muscle electrical activity",
    parameters: [
      "Any fluctuation in the EMG signal may indicate muscles are active",
      "Try to move the muscle to see the effect on the EMG signal"
    ]
  }
};




const MQTTClient = () => {
  const [client, setClient] = useState<any>(null);
  const [currentMode, setCurrentMode] = useState("none");
  const [sensorData, setSensorData] = useState({
    ecg: [] as number[],
    temp: "0",
    health: { heartRate: "N/A", spO2: "N/A" },
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
        
        switch(msg.topic) {
          case "sensor/ecg":
            ecgData.current = [
              ...ecgData.current.slice(-MAX_DATA_POINTS + 1), 
              parseSafeFloat(value) // Use safe parser
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
              parseSafeFloat(value) // Use safe parser
            ];
            setSensorData(prev => ({...prev, emg: [...emgData.current]}));
            break;
        }
      });

      mqttClient.connect();
      setClient(mqttClient);
    });

    return () => client?.disconnect();
  }, []);

  const sendCommand = (command: string) => {
    if (client?.isConnected()) {
      client.publish(COMMAND_TOPIC, command, 0, false);
      setCurrentMode(command === "stop" ? "none" : command);
    }
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
    
    return (  // Added missing return statement
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
      <View style={styles.container1}></View>
      <Text style={styles.header}>Vital Link</Text>
      
      <View style={styles.buttonContainer}>
        {["ecg", "temp", "health", "emg"].map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.button,
              currentMode === mode && styles.activeButton
            ]}
            onPress={() => sendCommand(mode)}
          >
            <Text style={styles.buttonText}>{mode.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
         <TouchableOpacity
    style={styles.stopButton}
    onPress={() => sendCommand("stop")}
  >
    <Text style={styles.buttonText}>STOP</Text>
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
        <Text style={styles.tempText}>{sensorData.temp}</Text>
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
          <Text style={styles.healthValue}>{sensorData.health.heartRate} BPM</Text>
        </View>
        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>SpO2:</Text>
          <Text style={styles.healthValue}>{sensorData.health.spO2}%</Text>
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
  container1:{
    padding:20
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f9fc',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
  },
  activeButton: {
    backgroundColor: '#27ae60',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
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
  stopButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
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
});

export default MQTTClient;