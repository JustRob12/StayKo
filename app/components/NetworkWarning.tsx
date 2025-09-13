import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

const NetworkWarning: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Check initial network state
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable;
      setIsConnected(connected);
      
      if (!connected) {
        // Slide down when no connection
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        // Slide up when connection restored
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => unsubscribe();
  }, [slideAnim]);

  // Don't render if connected
  if (isConnected) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="wifi-outline" size={20} color="#ffffff" />
        <Text style={styles.text}>Oops! You have no internet connection</Text>
        <Ionicons name="refresh" size={20} color="#ffffff" />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#EF4444',
    paddingTop: 50, // Account for status bar
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
    textAlign: 'center',
  },
});

export default NetworkWarning;
