import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, ActivityIndicator, ScrollView, TouchableWithoutFeedback } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

interface Feed {
  created_at: string;
  entry_id: number;
  field1: string;
  field2: string;
  field3?: string;
}

interface ChannelData {
  channel: {
    id: number;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    last_entry_id: number;
  };
  feeds: Feed[];
}

interface DataPoint {
  value: number;
  timestamp: string;
  label: string;
}

const ChartScreen: React.FC = () => {
  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [field1Data, setField1Data] = useState<DataPoint[]>([]);
  const [field2Data, setField2Data] = useState<DataPoint[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Maximum number of data points to display - adjusted to prevent overcrowding
  const MAX_DATA_POINTS = 15;

  const getEnvVar = (name: string): string | null => {
    if (Constants.expoConfig?.extra && Constants.expoConfig.extra[name] !== undefined) {
      return Constants.expoConfig.extra[name];
    }
    if (Constants.manifest?.extra && Constants.manifest.extra[name] !== undefined) {
      return Constants.manifest.extra[name];
    }
    
    console.warn(`Environment variable ${name} not found in Constants`);
    return null;
  };

  const CHANNEL_ID = getEnvVar('CHANNEL_ID') || '2899206'; // Fallback to the channel ID from screenshot
  const READ_API_KEY = getEnvVar('READ_API_KEY') || '';

  const fetchChannelData = async () => {
    if (!CHANNEL_ID) {
      setError("Channel ID not available");
      setLoading(false);
      return;
    }

    try {
      const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?${READ_API_KEY ? `api_key=${READ_API_KEY}&` : ''}results=${MAX_DATA_POINTS}`;
      const response = await axios.get(url);
      setChannelData(response.data);
      
      // Process data for charts
      if (response.data && response.data.feeds) {
        processChartData(response.data.feeds);
      }
    } catch (error: any) {
      console.error('Error fetching channel data:', error);
      setError(error.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (feeds: Feed[]) => {
    // Sort feeds by created_at to ensure chronological order
    const sortedFeeds = [...feeds].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // Limit to MAX_DATA_POINTS most recent entries
    const limitedFeeds = sortedFeeds.slice(-MAX_DATA_POINTS);
    
    const field1Points: DataPoint[] = [];
    const field2Points: DataPoint[] = [];
    
    limitedFeeds.forEach(feed => {
      const date = new Date(feed.created_at);
      const formattedTime = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      if (feed.field1) {
        field1Points.push({
          value: parseFloat(feed.field1),
          timestamp: feed.created_at,
          label: formattedTime
        });
      }
      
      if (feed.field2) {
        field2Points.push({
          value: parseFloat(feed.field2),
          timestamp: feed.created_at,
          label: formattedTime
        });
      }
    });
    
    setField1Data(field1Points);
    setField2Data(field2Points);
  };

  useEffect(() => {
    fetchChannelData();
    
    // Set up polling for real-time updates (every 15 seconds)
    intervalRef.current = setInterval(() => {
      fetchChannelData();
    }, 15000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Get the width of the container accounting for padding
  const containerWidth = Dimensions.get('window').width - 40; // 20px padding on each side
  const chartContainerWidth = containerWidth - 30; // 15px padding on each side of the chart container
  
  // Calculate the actual chart area width
  const chartWidth = chartContainerWidth - 70; // Leave space for y-axis labels and padding
  
  // Line chart component - improved with interaction and more y-axis labels
  const CustomLineChart = ({ 
    data, 
    color, 
    maxValue 
  }: { 
    data: DataPoint[], 
    color: string, 
    maxValue: number 
  }) => {
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
    
    if (!data || data.length === 0) {
      return <Text style={styles.noDataText}>No data available</Text>;
    }

    const height = 200;
    const paddingBottom = 30; // Space for labels
    const chartHeight = height - paddingBottom;
    
    // Calculate min and max for proper scaling
    let minValue = Math.min(...data.map(d => d.value));
    minValue = Math.max(0, minValue - (maxValue - minValue) * 0.1); // Add some breathing room at the bottom
    
    // Adjust max value to add breathing room at the top
    const adjustedMaxValue = maxValue * 1.1;
    
    // Calculate the effective range for scaling
    const valueRange = adjustedMaxValue - minValue;
    
    // Generate more y-axis tick values - 5 ticks evenly spaced
    const yAxisTicks = Array.from({ length: 5 }, (_, i) => {
      const value = minValue + (valueRange * i / 4);
      return value.toFixed(1);
    });

    // Handle tapping on a data point
    const handlePointPress = (index: number) => {
      setSelectedPoint(selectedPoint === index ? null : index);
    };

    return (
      <View style={styles.chartWrapper}>
        {/* Y-axis values - now with 5 values */}
        <View style={styles.yAxisLabels}>
          {yAxisTicks.reverse().map((value, i) => (
            <Text key={i} style={styles.axisLabel}>{value}</Text>
          ))}
        </View>
        
        <View style={styles.chartArea}>
          {/* Chart grid lines - now with 5 lines */}
          <View style={styles.gridLines}>
            {yAxisTicks.map((_, i) => (
              <View key={i} style={styles.gridLine} />
            ))}
          </View>
          
          <View style={{ height: chartHeight, width: '100%', position: 'relative' }}>
            {/* Draw line segments between points */}
            {data.map((point, index) => {
                  if (index === data.length - 1) return null;
                  
                  const x1 = (index / (data.length - 1)) * chartWidth;
                  const y1 = chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
                  const x2 = ((index + 1) / (data.length - 1)) * chartWidth;
                  const y2 = chartHeight - ((data[index + 1].value - minValue) / valueRange) * chartHeight;
                  
                  // Calculate length and angle of the line
                  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
                  
                  return (
                    <View
                      key={index}
                      style={{
                        position: 'absolute',
                        left: x1,
                        top: y1,
                        width: length,
                        height: 2,
                        backgroundColor: color,
                        transformOrigin: '0 0',
                        transform: [{ 
                          rotate: angle + 'deg'
                        }],
                      }}
                    />
                  );
                })}
            
            {/* Draw data points with touch interaction */}
            {data.map((point, index) => {
              const x = (index / (data.length - 1)) * 100 + '%';
              const y = chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
              const isSelected = selectedPoint === index;
              
              return (
                <React.Fragment key={`point-${index}`}>
                  <TouchableWithoutFeedback onPress={() => handlePointPress(index)}>
                    <View
                      style={{
                        position: 'absolute',
                        left: x,
                        top: y - 4,
                        width: 20, // Increase touch target size
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: [{ translateX: -10 }], // Center the touch target
                      }}
                    >
                      <View
                        style={{
                          width: isSelected ? 12 : 8,
                          height: isSelected ? 12 : 8,
                          borderRadius: isSelected ? 6 : 4,
                          backgroundColor: color,
                          borderWidth: isSelected ? 2 : 0,
                          borderColor: '#fff',
                        }}
                      />
                    </View>
                  </TouchableWithoutFeedback>
                  
                  {/* Show value bubble when a point is selected */}
                  {isSelected && (
                    <View 
                      style={{
                        position: 'absolute',
                        left: x,
                        top: y - 30, // Position above the point
                        backgroundColor: '#333',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 4,
                        transform: [{ translateX: -20 }], // Center the bubble
                      }}
                    >
                      <Text style={styles.bubbleValue}>{point.value.toFixed(2)}</Text>
                      <View style={styles.bubbleArrow} />
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>
          
          {/* X-axis labels */}
          <View style={styles.xAxisLabels}>
            {data.map((point, index) => {
              // Only show a subset of labels to prevent overcrowding
              const labelSpacing = data.length > 10 ? Math.ceil(data.length / 5) : 2;
              const showLabel = index === 0 || 
                              index === data.length - 1 || 
                              index % labelSpacing === 0;
              
              if (!showLabel) return null;
              
              return (
                <Text 
                  key={index} 
                  style={[
                    styles.xAxisLabel,
                    { 
                      left: (index / (data.length - 1)) * 100 + '%',
                      transform: [{ translateX: -20 }]  // Center the label
                    }
                  ]}
                >
                  {point.label}
                </Text>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Real-time Data Charts</Text>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}
      
      {loading && !channelData ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <>
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Field 1 Data</Text>
            <View style={styles.valueContainer}>
              {field1Data.length > 0 && (
                <Text style={styles.currentValue}>
                  Current: {field1Data[field1Data.length - 1].value.toFixed(2)}
                </Text>
              )}
            </View>
            <CustomLineChart 
              data={field1Data} 
              color="#1e88e5" 
              maxValue={Math.max(...field1Data.map(d => d.value), 0.1)} 
            />
          </View>
          
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Field 2 Data</Text>
            <View style={styles.valueContainer}>
              {field2Data.length > 0 && (
                <Text style={styles.currentValue}>
                  Current: {field2Data[field2Data.length - 1].value.toFixed(2)}
                </Text>
              )}
            </View>
            <CustomLineChart 
              data={field2Data} 
              color="#4caf50" 
              maxValue={Math.max(...field2Data.map(d => d.value), 0.1)} 
            />
          </View>
          
          <Text style={styles.updateText}>
            Auto-updating every 15 seconds
          </Text>
          
          <Text style={styles.helpText}>
            Tap on any data point to see its exact value
          </Text>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f8fa',
    minHeight: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  chartContainer: {
    marginBottom: 30,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',  // This prevents content from overflowing the container
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  chartWrapper: {
    flexDirection: 'row',
    paddingTop: 10,
    width: '100%',
    height: 200,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    height: 200,
    paddingRight: 10, // Add right padding to ensure chart stays within bounds
  },
  yAxisLabels: {
    width: 40,
    height: 170,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 5,
  },
  xAxisLabels: {
    height: 30,
    position: 'relative',
    width: '100%',
  },
  xAxisLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    width: 40,
    bottom: 0,
  },
  axisLabel: {
    fontSize: 10,
    color: '#666',
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 170, // chart height - paddingBottom
    justifyContent: 'space-between',
    zIndex: -1,
  },
  gridLine: {
    height: 1,
    backgroundColor: '#f0f0f0',
    width: '100%',
  },
  valueContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  currentValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bubbleValue: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
  bubbleArrow: {
    position: 'absolute',
    bottom: -5,
    left: '50%',
    marginLeft: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#333',
  },
  errorContainer: {
    padding: 15,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#c62828',
  },
  noDataText: {
    textAlign: 'center',
    padding: 30,
    color: '#757575',
  },
  updateText: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#666',
    marginTop: 10,
    marginBottom: 5,
  },
  helpText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  }
});

export default ChartScreen;