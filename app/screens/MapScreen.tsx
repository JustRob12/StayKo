import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Modal, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { propertiesService, propertyPhotosService, Property } from '../lib/properties';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

const MapScreen: React.FC = () => {
  const { user } = useAuth();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyPhotos, setPropertyPhotos] = useState<{[key: string]: string[]}>({});
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    getCurrentLocation();
    loadAllProperties();
  }, []);

  const loadAllProperties = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      
      // Load all properties for the map view
      const propertiesList = await propertiesService.getAllProperties();
      setProperties(propertiesList);
      
      // Load photos for each property
      const photosMap: {[key: string]: string[]} = {};
      for (const property of propertiesList) {
        const photos = await propertyPhotosService.getPropertyPhotos(property.id);
        photosMap[property.id] = photos.map(photo => photo.photo_url);
      }
      setPropertyPhotos(photosMap);
      
      // Update map with property markers
      if (webViewRef.current && propertiesList.length > 0) {
        const script = `updatePropertyMarkers(${JSON.stringify(propertiesList)});`;
        webViewRef.current.injectJavaScript(script);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    
    try {
      // Get fresh location first
      const freshLocation = await getCurrentLocationAndReturn();
      
      // Then load all properties
      await loadAllProperties(true);
      
      // Center map on user's current location after refresh
      if (freshLocation && webViewRef.current) {
        const { latitude, longitude } = freshLocation.coords;
        const script = `updateMapLocation(${latitude}, ${longitude});`;
        webViewRef.current.injectJavaScript(script);
      }
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const openPropertyModal = (property: Property) => {
    setSelectedProperty(property);
    setCurrentImageIndex(0);
    setShowPropertyModal(true);
  };

  const closePropertyModal = () => {
    setShowPropertyModal(false);
    setSelectedProperty(null);
    setCurrentImageIndex(0);
  };

  const nextImage = () => {
    if (selectedProperty) {
      const photos = propertyPhotos[selectedProperty.id] || [];
      setCurrentImageIndex((prev) => (prev + 1) % photos.length);
    }
  };

  const prevImage = () => {
    if (selectedProperty) {
      const photos = propertyPhotos[selectedProperty.id] || [];
      setCurrentImageIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'rent': return '#3B82F6';
      case 'sale': return '#22C55E';
      case 'boarding': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return '#22C55E';
      case 'Unavailable': return '#EF4444';
      default: return '#6B7280';
    }
  };

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
        timeInterval: 10000, // Update every 10 seconds
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

  const getCurrentLocationAndReturn = async (): Promise<Location.LocationObject | null> => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return null;
      }

      // Get current location with better accuracy settings
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 10000, // Update every 10 seconds
      });

      setLocation(currentLocation);
      console.log('Fresh location for refresh:', currentLocation);
      
      return currentLocation;
    } catch (err) {
      console.error('Error getting fresh location:', err);
      setError('Failed to get location. Please check your GPS settings.');
      return null;
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
        .property-popup {
          max-width: 250px;
        }
        .property-popup h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #1F2937;
        }
        .property-popup p {
          margin: 4px 0;
          font-size: 14px;
          color: #6B7280;
        }
        .property-popup .price {
          font-weight: bold;
          color: #22C55E;
          font-size: 16px;
        }
        .property-popup .type {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          color: white;
          margin-bottom: 8px;
        }
        .property-popup .type.rent { background-color: #3B82F6; }
        .property-popup .type.sale { background-color: #22C55E; }
        .property-popup .type.boarding { background-color: #F59E0B; }
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
        let userMarker;
        let propertyMarkers = [];
        
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
          
          // Add custom user marker
          const userIcon = L.divIcon({
            className: 'user-marker',
            html: '<div style="background-color: #22C55E; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          userMarker = L.marker([defaultLat, defaultLng], { icon: userIcon }).addTo(map);
          
          // Hide loading
          document.getElementById('loading').style.display = 'none';
          
          // Notify React Native that map is ready
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'mapReady'}));
        }
        
        // Function to update map location
        function updateMapLocation(lat, lng) {
          if (map && userMarker) {
            map.setView([lat, lng], 16);
            userMarker.setLatLng([lat, lng]);
            console.log('Map location updated to:', lat, lng);
          }
        }
        
        // Function to update property markers
        function updatePropertyMarkers(properties) {
          // Clear existing property markers
          propertyMarkers.forEach(marker => map.removeLayer(marker));
          propertyMarkers = [];
          
          if (!properties || properties.length === 0) return;
          
          // Create property markers
          properties.forEach(property => {
            if (property.latitude && property.longitude) {
              // Create property icon based on type
              const typeColors = {
                'rent': '#3B82F6',
                'sale': '#22C55E',
                'boarding': '#F59E0B'
              };
              
              const propertyIcon = L.divIcon({
                className: 'property-marker',
                html: \`<div style="background-color: \${typeColors[property.type] || '#6B7280'}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>\`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              });
              
              // Create popup content
              const popupContent = \`
                <div class="property-popup">
                  <span class="type \${property.type}">\${property.type.toUpperCase()}</span>
                  <h3>\${property.title}</h3>
                  <p class="price">\${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 }).format(property.price)}</p>
                  <p>\${property.location || 'Location not specified'}</p>
                  <button onclick="selectProperty('\${property.id}')" style="background-color: #22C55E; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 8px; width: 100%;">
                    View Details
                  </button>
                </div>
              \`;
              
              const marker = L.marker([property.latitude, property.longitude], { icon: propertyIcon })
                .addTo(map)
                .bindPopup(popupContent);
              
              propertyMarkers.push(marker);
            }
          });
          
          // Fit map to show all markers if there are properties
          if (propertyMarkers.length > 0) {
            const group = new L.featureGroup(propertyMarkers);
            map.fitBounds(group.getBounds().pad(0.1));
          }
        }
        
        // Function to select property (called from popup)
        function selectProperty(propertyId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'propertySelected',
            propertyId: propertyId
          }));
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
            } else if (data.type === 'propertySelected') {
              const property = properties.find(p => p.id === data.propertyId);
              if (property) {
                openPropertyModal(property);
              }
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
      
      {/* Refresh Button */}
      <TouchableOpacity 
        style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
        onPress={handleRefresh}
        disabled={refreshing}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color="#22C55E" />
        ) : (
          <Ionicons 
            name="refresh-outline" 
            size={24} 
            color="#22C55E" 
          />
        )}
      </TouchableOpacity>
{/* 
      {location && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationInfoText}>
            📍 Lat: {location.coords.latitude.toFixed(6)}
          </Text>
          <Text style={styles.locationInfoText}>
            📍 Lng: {location.coords.longitude.toFixed(6)}
          </Text>
          <Text style={styles.accuracyText}>
            Accuracy: {location.coords.accuracy?.toFixed(0)}m
          </Text>
        </View>
      )} */}

      {/* Property Detail Modal */}
      <Modal
        visible={showPropertyModal}
        animationType="slide"
        onRequestClose={closePropertyModal}
      >
        {selectedProperty && (
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closePropertyModal}
              >
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Property Details</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Image Carousel */}
              {propertyPhotos[selectedProperty.id] && propertyPhotos[selectedProperty.id].length > 0 ? (
                <View style={styles.imageCarousel}>
                  <Image 
                    source={{ uri: propertyPhotos[selectedProperty.id][currentImageIndex] }} 
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                  
                  {/* Navigation Arrows */}
                  {propertyPhotos[selectedProperty.id].length > 1 && (
                    <>
                      <TouchableOpacity 
                        style={[styles.navArrow, styles.prevArrow]}
                        onPress={prevImage}
                      >
                        <Ionicons name="chevron-back" size={24} color="#ffffff" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.navArrow, styles.nextArrow]}
                        onPress={nextImage}
                      >
                        <Ionicons name="chevron-forward" size={24} color="#ffffff" />
                      </TouchableOpacity>
                    </>
                  )}
                  
                  {/* Image Counter */}
                  {propertyPhotos[selectedProperty.id].length > 1 && (
                    <View style={styles.imageCounter}>
                      <Text style={styles.imageCounterText}>
                        {currentImageIndex + 1} / {propertyPhotos[selectedProperty.id].length}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.noImageContainer}>
                  <Ionicons name="image-outline" size={64} color="#9CA3AF" />
                  <Text style={styles.noImageText}>No images available</Text>
                </View>
              )}

              {/* Property Information */}
              <View style={styles.propertyDetails}>
                <View style={styles.propertyHeader}>
                  <Text style={styles.propertyTitle}>{selectedProperty.title}</Text>
                  <View style={styles.badgeContainer}>
                    <View style={[styles.typeBadge, { backgroundColor: getTypeColor(selectedProperty.type) }]}>
                      <Text style={styles.typeText}>{selectedProperty.type.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedProperty.status) }]}>
                      <Text style={styles.statusText}>{selectedProperty.status}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.propertyPrice}>{formatPrice(selectedProperty.price)}</Text>

                {selectedProperty.description && (
                  <View style={styles.descriptionSection}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>{selectedProperty.description}</Text>
                  </View>
                )}

                <View style={styles.locationSection}>
                  <Text style={styles.sectionTitle}>Location</Text>
                  <Text style={styles.locationText}>
                    {selectedProperty.location || 'Location not specified'}
                  </Text>
                  {selectedProperty.latitude && selectedProperty.longitude && (
                    <Text style={styles.coordinatesText}>
                      📍 {selectedProperty.latitude.toFixed(6)}, {selectedProperty.longitude.toFixed(6)}
                    </Text>
                  )}
                </View>

                {/* Contact Information */}
                <View style={styles.contactSection}>
                  <Text style={styles.sectionTitle}>Contact Information</Text>
                  
                  {selectedProperty.contact_name && (
                    <View style={styles.contactItem}>
                      <Ionicons name="person" size={20} color="#6B7280" />
                      <Text style={styles.contactText}>{selectedProperty.contact_name}</Text>
                    </View>
                  )}
                  
                  {selectedProperty.contact_number && (
                    <TouchableOpacity style={styles.contactItem}>
                      <Ionicons name="call" size={20} color="#22C55E" />
                      <Text style={[styles.contactText, styles.contactLink]}>
                        {selectedProperty.contact_number}
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {selectedProperty.contact_email && (
                    <TouchableOpacity style={styles.contactItem}>
                      <Ionicons name="mail" size={20} color="#22C55E" />
                      <Text style={[styles.contactText, styles.contactLink]}>
                        {selectedProperty.contact_email}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
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
  locationInfoText: {
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
  // Refresh button styles
  refreshButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#ffffff',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  refreshButtonDisabled: {
    opacity: 0.6,
    borderColor: '#9CA3AF',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
  },
  // Image carousel styles
  imageCarousel: {
    position: 'relative',
    height: 250,
    backgroundColor: '#F3F4F6',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  prevArrow: {
    left: 16,
  },
  nextArrow: {
    right: 16,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCounterText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  noImageContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  noImageText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9CA3AF',
  },
  // Property details styles
  propertyDetails: {
    padding: 20,
  },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  propertyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  propertyPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
  },
  locationSection: {
    marginBottom: 20,
  },
  locationText: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 4,
  },
  coordinatesText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  contactSection: {
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#4B5563',
    marginLeft: 12,
  },
  contactLink: {
    color: '#22C55E',
    textDecorationLine: 'underline',
  },
});

export default MapScreen;
