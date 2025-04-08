import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Button, Linking } from 'react-native';
import axios from 'axios';

export default function App() {
  const [channelData, setChannelData] = useState(null);
  const [loading, setLoading] = useState(true);

  const CHANNEL_ID = '2899206';
  const READ_API_KEY = 'K5H4IGTGX5E20NMW';

  useEffect(() => {
    const fetchChannelData = async () => {
      try {
        const response = await axios.get(
          `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=10`
        );
        setChannelData(response.data);
      } catch (error) {
        console.error('Error fetching channel data:', error);
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
});
