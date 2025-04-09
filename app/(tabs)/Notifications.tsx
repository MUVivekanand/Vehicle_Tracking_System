import React, { useEffect, useRef, useState } from 'react';
import { Platform, AppState, View, Text, StyleSheet, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import axios from 'axios';

// Configure notifications behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationServiceProps {
  channelId: string;
  readApiKey?: string;
  pollingInterval?: number; // Time in ms
  field1Threshold?: number;  // Gas sensor threshold
  field2Threshold?: number;  // Vibration sensor threshold
  showNotificationUI?: boolean; // Whether to show notification UI component
  projectId?: string; // Added projectId as a prop
  maxNotificationsHeight?: number; // Maximum height for notifications container
}

interface NotificationData {
  title: string;
  body: string;
  timestamp: Date;
}

const NotificationService: React.FC<NotificationServiceProps> = ({
  channelId,
  readApiKey = '',
  pollingInterval = 10000, // Default polling every 10 seconds
  field1Threshold = 20.0,  // Default gas threshold
  field2Threshold = 1.0,   // Default vibration threshold
  showNotificationUI = true, // Show UI component by default
  projectId = undefined, // Optional projectId parameter
  maxNotificationsHeight = 300, // Default max height for notifications
}) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const appState = useRef(AppState.currentState);
  const lastField1Alert = useRef<number>(0);
  const lastField2Alert = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Minimum time between alerts in milliseconds (5 minutes)
  const ALERT_COOLDOWN = 5 * 60 * 1000;

  // Request permissions on component mount
  useEffect(() => {
    registerForPushNotificationsAsync(projectId).then(token => {
      setExpoPushToken(token);
      console.log('Push token registered:', token);
    });
    
    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(
      notification => {
        console.log('Notification received by listener:', notification);
        // Store the notification in our state
        const newNotification: NotificationData = {
          title: notification.request.content.title || 'No Title',
          body: notification.request.content.body || 'No Body',
          timestamp: new Date(notification.date),
        };
        setNotifications(prev => [newNotification, ...prev]);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => {
        console.log('User responded to notification:', response);
      }
    );

    // Set up AppState listener to handle app in background/foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
        // Check for received notifications while app was in background
        Notifications.getPresentedNotificationsAsync().then(notifications => {
          console.log('Pending notifications:', notifications);
        });
      }
      appState.current = nextAppState;
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
      subscription.remove();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [projectId]);

  // Set up data polling effect
  useEffect(() => {
    // Initial fetch
    fetchLatestSensorData();
    
    // Set up polling interval
    pollingIntervalRef.current = setInterval(() => {
      fetchLatestSensorData();
    }, pollingInterval);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [channelId, readApiKey, pollingInterval, field1Threshold, field2Threshold]);

  
  // Function to fetch latest sensor data
  const fetchLatestSensorData = async () => {
    try {
      const url = `https://api.thingspeak.com/channels/${'2899206'}/feeds/last.json${'K5H4IGTGX5E20NMW' ? `?api_key=${'K5H4IGTGX5E20NMW'}` : ''}`;
      const response = await axios.get(url);
      const data = response.data;
      
      if (!data) {
        console.log('No data received from ThingSpeak');
        return;
      }
      
      // Check thresholds and send notifications if needed
      checkAndSendNotifications(data);
      
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    }
  };

  // Function to check thresholds and send notifications
  const checkAndSendNotifications = (data: any) => {
    const now = Date.now();
    
    // Check field1 (gas sensor)
    if (data.field1 && parseFloat(data.field1) > field1Threshold) {
      // Only send notification if cooldown time has passed
      if (now - lastField1Alert.current > ALERT_COOLDOWN) {
        lastField1Alert.current = now;
        
        scheduleLocalNotification({
          title: 'Vehicle Health Alert! 🚨',
          body: `Gas sensor reading critical: ${parseFloat(data.field1).toFixed(2)} (Threshold: ${field1Threshold})`,
          data: { type: 'field1_alert', value: data.field1, timestamp: data.created_at },
          priority: 'max' // Use max priority to ensure it shows up
        });
      }
    }
    
    // Check field2 (vibration sensor)
    if (data.field2 && parseFloat(data.field2) >= field2Threshold) {
      // Only send notification if cooldown time has passed
      if (now - lastField2Alert.current > ALERT_COOLDOWN) {
        lastField2Alert.current = now;
        
        scheduleLocalNotification({
          title: 'Possible Accident Detected! 🚨',
          body: `Abnormal vibration detected: ${parseFloat(data.field2).toFixed(2)} (Threshold: ${field2Threshold})`,
          data: { type: 'field2_alert', value: data.field2, timestamp: data.created_at },
          priority: 'max' // Use max priority for critical alerts
        });
      }
    }
  };

  // Function to schedule a local notification (works without push token)
  const scheduleLocalNotification = async ({ 
    title, 
    body, 
    data = {}, 
    priority = 'default' 
  }: { 
    title: string, 
    body: string, 
    data?: any, 
    priority?: 'default' | 'high' | 'max' 
  }) => {
    try {
      // For local notifications (works in foreground and background)
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          vibrate: [0, 250, 250, 250],
          priority: priority === 'high' ? Notifications.AndroidNotificationPriority.HIGH : 
                  priority === 'max' ? Notifications.AndroidNotificationPriority.MAX : 
                  Notifications.AndroidNotificationPriority.DEFAULT,
          badge: 1,
        },
        trigger: null, // null means show immediately
      });
      
      console.log(`Local notification scheduled with ID: ${notificationId}`);
      
      // Also add to our UI list
      const newNotification: NotificationData = {
        title,
        body,
        timestamp: new Date(),
      };
      setNotifications(prev => [newNotification, ...prev]);
      
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  // Register for push notifications
  async function registerForPushNotificationsAsync(projectId?: string) {
    let token;
    
    if (Platform.OS === 'android') {
      // Set up notification channel for Android
      await Notifications.setNotificationChannelAsync('sensor-alerts', {
        name: 'Sensor Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: true,
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
    }
    
    if (Device.isDevice) {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      // If permissions not granted, request them
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.error('Failed to get push token for push notification!');
        return undefined;
      }
      
      try {
        // Try to get token if projectId is provided, otherwise we'll use local notifications only
        if (projectId) {
          token = (await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          })).data;
          console.log('Successfully obtained Expo push token with provided projectId');
        } else {
          // Try to get from Constants if available
          const constantsProjectId = Constants.expoConfig?.extra?.eas?.projectId;
          if (constantsProjectId) {
            token = (await Notifications.getExpoPushTokenAsync({
              projectId: constantsProjectId,
            })).data;
            console.log('Successfully obtained Expo push token with Constants projectId');
          } else {
            console.log('No projectId available for push notifications. Using local notifications only.');
          }
        }
      } catch (error) {
        console.error('Error getting Expo push token:', error);
        console.log('Will use local notifications only');
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  // If UI component display is requested, show the notification history
  if (!showNotificationUI) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent Notifications</Text>
      {notifications.length === 0 ? (
        <Text style={styles.emptyText}>No notifications yet</Text>
      ) : (
        <ScrollView 
          style={[styles.scrollContainer, { maxHeight: maxNotificationsHeight }]}
          showsVerticalScrollIndicator={true}
        >
          {notifications.map((notification, index) => (
            <View key={index} style={styles.notificationItem}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationBody}>{notification.body}</Text>
              <Text style={styles.notificationTime}>
                {notification.timestamp.toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    marginVertical: 20,
  },
  scrollContainer: {
    width: '100%',
  },
  notificationItem: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  notificationTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
});

export default NotificationService;