import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

const MapScreen: React.FC = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return;
      }

      // Get current location with better accuracy settings
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        maximumAge: 10000, // Accept location up to 10 seconds old
        timeout: 15000, // Wait up to 15 seconds for location
      });

      setLocation(currentLocation);
      console.log('Current location:', currentLocation);

      // Update map with new location immediately
      if (webViewRef.current) {
        const { latitude, longitude } = currentLocation.coords;
        const script = `updateMapLocation(${latitude}, ${longitude});`;
        webViewRef.current.injectJavaScript(script);
      }
    } catch (err) {
      console.error('Error getting location:', err);
      setError('Failed to get location. Please check your GPS settings.');
    } finally {
      setLoading(false);
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for GPS tracking');
        return;
      }

      // Start watching position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000, // Update every 3 seconds
          distanceInterval: 5, // Update every 5 meters
        },
        (newLocation) => {
          setLocation(newLocation);
          console.log('Location updated:', newLocation);

          // Update map with new location
          if (webViewRef.current) {
            const { latitude, longitude } = newLocation.coords;
            const script = `updateMapLocation(${latitude}, ${longitude});`;
            webViewRef.current.injectJavaScript(script);
          }
        }
      );

      return subscription;
    } catch (err) {
      console.error('Error starting location tracking:', err);
      Alert.alert('Error', 'Failed to start location tracking');
    }
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>StayKo Map</title>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
        }
        #map {
          width: 100%;
          height: 100vh;
        }
        .loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.9);
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 1000;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="loading" id="loading">
        <div style="text-align: center;">
          <div style="width: 30px; height: 30px; border: 3px solid #22C55E; border-top: 3px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
          <div style="color: #22C55E; font-weight: bold;">Loading Map...</div>
        </div>
      </div>
      
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        let map;
        let marker;
        
        // Initialize map
        function initMap() {
          // Default location (will be updated when real location is received)
          const defaultLat = 0;
          const defaultLng = 0;
          
          map = L.map('map').setView([defaultLat, defaultLng], 2);
          
          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);
          
          // Add custom marker
          const customIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: #22C55E; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          marker = L.marker([defaultLat, defaultLng], { icon: customIcon }).addTo(map);
          
          // Hide loading
          document.getElementById('loading').style.display = 'none';
          
          // Notify React Native that map is ready
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'mapReady'}));
        }
        
        // Function to update map location
        function updateMapLocation(lat, lng) {
          if (map && marker) {
            map.setView([lat, lng], 16);
            marker.setLatLng([lat, lng]);
            console.log('Map location updated to:', lat, lng);
          }
        }
        
        // CSS for loading animation
        const style = document.createElement('style');
        style.textContent = \`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        \`;
        document.head.appendChild(style);
        
        // Initialize map when page loads
        window.addEventListener('load', initMap);
      </script>
    </body>
    </html>
  `;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <Text style={styles.errorSubtext}>Please enable location permissions in your device settings</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onLoadEnd={() => {
          setLoading(false);
          // Start location tracking after map loads
          startLocationTracking();
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'mapReady') {
              console.log('Map is ready, getting location...');
              getCurrentLocation();
            }
          } catch (error) {
            console.error('Error parsing WebView message:', error);
          }
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
      
      {location && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>
            📍 Lat: {location.coords.latitude.toFixed(6)}
          </Text>
          <Text style={styles.locationText}>
            📍 Lng: {location.coords.longitude.toFixed(6)}
          </Text>
          <Text style={styles.accuracyText}>
            Accuracy: {location.coords.accuracy?.toFixed(0)}m
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(240, 253, 244, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  locationInfo: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    marginBottom: 2,
  },
  accuracyText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 5,
  },
});

export default MapScreen;
