import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Button, Linking } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

export default function App() {
  const [channelData, setChannelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getEnvVar = (name) => {
    if (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra[name] !== undefined) {
      return Constants.expoConfig.extra[name];
    }
    if (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra[name] !== undefined) {
      return Constants.manifest.extra[name];
    }
    
    console.warn(`Environment variable ${name} not found in Constants`);
    return null;
  };

  const CHANNEL_ID = getEnvVar('CHANNEL_ID');
  const READ_API_KEY = getEnvVar('READ_API_KEY');

  console.log("CHANNEL_ID:", CHANNEL_ID);
  console.log("READ_API_KEY:", READ_API_KEY ? "Exists" : "Not found");

  useEffect(() => {
    const fetchChannelData = async () => {
      if (!CHANNEL_ID || !READ_API_KEY) {
        setError("Environment variables not loaded properly");
        setLoading(false);
        return;
      }

      try {
        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=10`;
        console.log("Fetching from URL:", url);
        
        const response = await axios.get(url);
        setChannelData(response.data);
      } catch (error) {
        console.error('Error fetching channel data:', error);
        setError(error.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchChannelData();
  }, []);

  const openGoogleMaps = (rawText) => {
    try {
      const match = rawText.match(/([\d.-]+),([\d.-]+)/);
      if (match) {
        const lat = match[1];
        const lng = match[2];
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        Linking.openURL(url).catch((err) => console.error("Failed to open Maps:", err));
      } else {
        console.warn("Invalid location format:", rawText);
      }
    } catch (e) {
      console.error("Error parsing location:", e);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>ThingSpeak Channel Data</Text>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : channelData ? (
        <>
          <Text style={styles.channelName}>{channelData.channel.name}</Text>
          {channelData.feeds.map((feed, index) => (
            <View key={index} style={styles.feedCard}>
              <Text>Entry ID: {feed.entry_id}</Text>
              <Text>Time: {feed.created_at}</Text>
              <Text>Field1: {feed.field1}</Text>
              <Text>Field2: {feed.field2}</Text>
              {feed.field3 ? (
                <Button
                  title="Open in Google Maps"
                  onPress={() => openGoogleMaps(feed.field3)}
                  color="#1e88e5"
                />
              ) : (
                <Text>No location data</Text>
              )}
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
    paddingTop: 50,
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
  }
});