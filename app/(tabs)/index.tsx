// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Button, Linking, Alert } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const [channelData, setChannelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState('5');
  const [location, setLocation] = useState(null);
  const [locationErrorMsg, setLocationErrorMsg] = useState(null);

  const getEnvVar = (name) => {
    const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra;
    if (extra && extra[name] !== undefined) {
      return extra[name];
    }
    console.warn(`Environment variable ${name} not found in Constants`);
    return null;
  };

  const CHANNEL_ID = getEnvVar('CHANNEL_ID') || '2899206';
  const READ_API_KEY = getEnvVar('READ_API_KEY') || '';

  useEffect(() => {
    fetchChannelData();
    getCurrentLocation();
  }, [selectedLogs]);

  const fetchChannelData = async () => {
    if (!CHANNEL_ID) {
      setError("Channel ID not available");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?${READ_API_KEY ? `api_key=${READ_API_KEY}&` : ''}results=${selectedLogs}&sort=desc`;
      const response = await axios.get(url);
      setChannelData(response.data);
    } catch (error) {
      setError(error.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationErrorMsg('Permission to access location was denied');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    } catch (error) {
      setLocationErrorMsg(error.message || 'Failed to get location');
    }
  };

  const openGoogleMaps = () => {
    if (!location) {
      Alert.alert("Location not available", "Please enable location permissions and try again.");
      return;
    }

    const lat = location.latitude;
    const lng = location.longitude;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    Linking.openURL(url).catch(err => console.error("Failed to open Maps:", err));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>ThingSpeak Channel Data</Text>

      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>View logs for:</Text>
        <Picker
          selectedValue={selectedLogs}
          style={styles.picker}
          onValueChange={(itemValue) => setSelectedLogs(itemValue)}
        >
          <Picker.Item label="Last 5 logs" value="5" />
          <Picker.Item label="Last 10 logs" value="10" />
          <Picker.Item label="Last 20 logs" value="20" />
        </Picker>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      {locationErrorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Location Error: {locationErrorMsg}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : channelData ? (
        <>
          <Text style={styles.channelName}>{channelData.channel.name || `Channel ${CHANNEL_ID}`}</Text>
          {channelData.feeds.map((feed, index) => (
            <View key={index} style={styles.feedCard}>
              <Text>Entry ID: {feed.entry_id}</Text>
              <Text>Time: {feed.created_at}</Text>
              <Button title="Open My Location in Google Maps" onPress={openGoogleMaps} color="#1e88e5" />
            </View>
          ))}
        </>
      ) : (
        <Text>No data available.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  channelName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  feedCard: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  errorContainer: {
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#c62828',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 5,
  },
  pickerLabel: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 10,
  },
  picker: {
    flex: 1,
    height: 70,
  },
});
