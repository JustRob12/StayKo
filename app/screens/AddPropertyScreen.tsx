import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Modal,
  Dimensions,
  Image,
  FlatList,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { propertiesService, CreatePropertyData, propertyPhotosService, Property } from '../lib/properties';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

const MyPropertiesScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const webViewRef = useRef<WebView>(null);

  // Form data for adding new property
  const [formData, setFormData] = useState<CreatePropertyData>({
    type: 'rent',
    title: '',
    description: '',
    price: 0,
    location: '',
    latitude: undefined,
    longitude: undefined,
    contact_name: '',
    contact_number: '',
    contact_email: '',
    status: 'Available',
  });

  // Load user's properties
  useEffect(() => {
    if (user?.id) {
      loadProperties();
    }
  }, [user?.id]);

  const loadProperties = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const userProperties = await propertiesService.getPropertiesByUser(user.id);
      setProperties(userProperties);
    } catch (error) {
      console.error('Error loading properties:', error);
      Alert.alert('Error', 'Failed to load your properties');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProperties();
    setRefreshing(false);
  };

  const handleInputChange = (field: keyof CreatePropertyData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
      case 'sale': return '#EF4444';
      case 'boarding': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const renderPropertyCard = ({ item }: { item: Property }) => (
    <TouchableOpacity style={styles.propertyCard}>
      <View style={styles.propertyImageContainer}>
        <View style={styles.propertyImagePlaceholder}>
          <Ionicons name="home" size={40} color="#22C55E" />
        </View>
        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) }]}>
          <Text style={styles.typeBadgeText}>{item.type.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.propertyInfo}>
        <Text style={styles.propertyTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.propertyLocation} numberOfLines={1}>
          <Ionicons name="location" size={14} color="#6B7280" /> {item.location || 'Location not specified'}
        </Text>
        <Text style={styles.propertyPrice}>{formatPrice(item.price)}</Text>
        
        <View style={styles.propertyActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="eye" size={16} color="#22C55E" />
            <Text style={styles.actionButtonText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="create" size={16} color="#3B82F6" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="trash" size={16} color="#EF4444" />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const openMapPicker = async () => {
    try {
      // Get current location first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to pick a location on the map.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setSelectedLocation({
        lat: currentLocation.coords.latitude,
        lng: currentLocation.coords.longitude
      });

      setShowMap(true);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your current location');
    }
  };

  const handleMapLocationSelect = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }));
    setShowMap(false);
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload property images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10, // Maximum 10 images
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      setSelectedImages(prev => [...prev, ...newImages].slice(0, 10)); // Limit to 10 images
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadToCloudinary = async (imageUri: string): Promise<string> => {
    const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    
    if (!cloudName || !uploadPreset) {
      throw new Error('Cloudinary configuration missing. Please check your .env file.');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'property.jpg',
    } as any);
    formData.append('upload_preset', uploadPreset);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (data.secure_url) {
      return data.secure_url;
    } else {
      throw new Error('No secure URL returned from Cloudinary');
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a property title');
      return;
    }

    if (!formData.price || formData.price <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location on the map');
      return;
    }

    setLoading(true);
    try {
      // Create property first
      const { data: property, error } = await propertiesService.createProperty({
        ...formData,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng
      });

      if (error) {
        throw new Error(error.message || 'Failed to create property');
      }

      // Upload images if any are selected
      if (selectedImages.length > 0 && property) {
        setUploadingImages(true);
        try {
          const uploadPromises = selectedImages.map(imageUri => 
            uploadToCloudinary(imageUri).then(photoUrl => 
              propertyPhotosService.addPropertyPhoto(property.id, photoUrl)
            )
          );

          await Promise.all(uploadPromises);
        } catch (uploadError) {
          console.error('Error uploading images:', uploadError);
          Alert.alert('Warning', 'Property created but some images failed to upload. You can add them later.');
        } finally {
          setUploadingImages(false);
        }
      }

      Alert.alert('Success', 'Property added successfully!', [
        { text: 'OK', onPress: () => {
          // Reset form
          setFormData({
            type: 'rent',
            title: '',
            description: '',
            price: 0,
            location: '',
            latitude: undefined,
            longitude: undefined,
            contact_name: '',
            contact_number: '',
            contact_email: '',
            status: 'Available',
          });
          setSelectedLocation(null);
          setSelectedImages([]);
          setShowAddForm(false);
          // Reload properties list
          loadProperties();
        }}
      ]);
    } catch (error) {
      console.error('Error creating property:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create property');
    } finally {
      setLoading(false);
    }
  };

  const mapHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Select Property Location</title>
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
        .location-info {
          position: absolute;
          top: 20px;
          left: 20px;
          right: 20px;
          background: rgba(255, 255, 255, 0.95);
          padding: 15px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 1000;
        }
        .select-button {
          position: absolute;
          bottom: 20px;
          left: 20px;
          right: 20px;
          background: #22C55E;
          color: white;
          padding: 15px;
          border-radius: 10px;
          text-align: center;
          font-weight: bold;
          cursor: pointer;
          z-index: 1000;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="location-info">
        <div style="font-weight: bold; margin-bottom: 5px;">📍 Select Property Location</div>
        <div id="coordinates">Tap on the map to select location</div>
      </div>
      <div class="select-button" onclick="selectLocation()">Select This Location</div>
      
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        let map;
        let marker;
        let selectedLat = ${selectedLocation?.lat || 0};
        let selectedLng = ${selectedLocation?.lng || 0};
        
        function initMap() {
          const defaultLat = selectedLat || 14.5995;
          const defaultLng = selectedLng || 120.9842;
          
          map = L.map('map').setView([defaultLat, defaultLng], 15);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);
          
          const customIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: #22C55E; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          marker = L.marker([defaultLat, defaultLng], { icon: customIcon }).addTo(map);
          
          // Update coordinates display
          updateCoordinates(defaultLat, defaultLng);
          
          // Add click event to map
          map.on('click', function(e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            
            selectedLat = lat;
            selectedLng = lng;
            
            marker.setLatLng([lat, lng]);
            updateCoordinates(lat, lng);
          });
        }
        
        function updateCoordinates(lat, lng) {
          document.getElementById('coordinates').innerHTML = 
            \`Lat: \${lat.toFixed(6)}, Lng: \${lng.toFixed(6)}\`;
        }
        
        function selectLocation() {
          if (selectedLat && selectedLng) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'locationSelected',
              lat: selectedLat,
              lng: selectedLng
            }));
          }
        }
        
        window.addEventListener('load', initMap);
      </script>
    </body>
    </html>
  `;

  if (showAddForm) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.formHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setShowAddForm(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.title}>🏠 Add New Property</Text>
          </View>
        
        {/* Property Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Property Type *</Text>
          <View style={styles.typeContainer}>
            {(['rent', 'sale', 'boarding'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  formData.type === type && styles.typeButtonActive
                ]}
                onPress={() => handleInputChange('type', type)}
              >
                <Text style={[
                  styles.typeButtonText,
                  formData.type === type && styles.typeButtonTextActive
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Property Title *</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(text) => handleInputChange('title', text)}
            placeholder="Enter property title"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => handleInputChange('description', text)}
            placeholder="Describe your property..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Price */}
        <View style={styles.section}>
          <Text style={styles.label}>Price (₱) *</Text>
          <TextInput
            style={styles.input}
            value={formData.price ? formData.price.toString() : ''}
            onChangeText={(text) => handleInputChange('price', parseFloat(text) || 0)}
            placeholder="Enter price"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={formData.location}
            onChangeText={(text) => handleInputChange('location', text)}
            placeholder="City, Barangay, etc."
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Map Location Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Map Location *</Text>
          <TouchableOpacity style={styles.mapButton} onPress={openMapPicker}>
            <Ionicons name="map" size={20} color="#22C55E" />
            <Text style={styles.mapButtonText}>
              {selectedLocation 
                ? `📍 Selected: ${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`
                : '📍 Pick Location on Map'
              }
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Property Images */}
        <View style={styles.section}>
          <Text style={styles.label}>Property Images</Text>
          <Text style={styles.imageSubtext}>Add up to 10 photos of your property</Text>
          
          <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
            <Ionicons name="camera" size={24} color="#22C55E" />
            <Text style={styles.addImageText}>Add Photos</Text>
          </TouchableOpacity>

          {selectedImages.length > 0 && (
            <View style={styles.imageGrid}>
              <FlatList
                data={selectedImages}
                keyExtractor={(item, index) => index.toString()}
                numColumns={3}
                scrollEnabled={false}
                renderItem={({ item, index }) => (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: item }} style={styles.selectedImage} />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          )}
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <Text style={styles.label}>Contact Name</Text>
          <TextInput
            style={styles.input}
            value={formData.contact_name}
            onChangeText={(text) => handleInputChange('contact_name', text)}
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            style={styles.input}
            value={formData.contact_number}
            onChangeText={(text) => handleInputChange('contact_number', text)}
            placeholder="Your phone number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Contact Email</Text>
          <TextInput
            style={styles.input}
            value={formData.contact_email}
            onChangeText={(text) => handleInputChange('contact_email', text)}
            placeholder="Your email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[styles.submitButton, (loading || uploadingImages) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || uploadingImages}
        >
          {loading || uploadingImages ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.submitButtonText}>
                {uploadingImages ? 'Uploading Images...' : 'Creating Property...'}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color="#ffffff" />
              <Text style={styles.submitButtonText}>Add Property</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Map Modal */}
      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowMap(false)}
            >
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Select Property Location</Text>
          </View>
          
          <WebView
            ref={webViewRef}
            source={{ html: mapHtmlContent }}
            style={styles.mapWebView}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'locationSelected') {
                  handleMapLocationSelect(data.lat, data.lng);
                }
              } catch (error) {
                console.error('Error parsing map message:', error);
              }
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      </Modal>
    </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Properties</Text>
        <Text style={styles.headerSubtitle}>
          {properties.length} {properties.length === 1 ? 'property' : 'properties'} listed
        </Text>
      </View>

      {/* Properties List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>Loading your properties...</Text>
        </View>
      ) : properties.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="home-outline" size={80} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Properties Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start by adding your first property to get started
          </Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => setShowAddForm(true)}
          >
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.emptyButtonText}>Add Your First Property</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          renderItem={renderPropertyCard}
          contentContainerStyle={styles.propertiesList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#22C55E']}
              tintColor="#22C55E"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setShowAddForm(true)}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  // Header styles
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  // Empty state styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Properties list styles
  propertiesList: {
    padding: 20,
    paddingBottom: 100,
  },
  propertyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  propertyImageContainer: {
    position: 'relative',
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  propertyImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  propertyInfo: {
    padding: 16,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  propertyLocation: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 16,
  },
  propertyActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Form styles (for add property form)
  form: {
    padding: 20,
    paddingBottom: 100,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 15,
  },
  mapButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 10,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    padding: 18,
    borderRadius: 12,
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    marginRight: 15,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  mapWebView: {
    flex: 1,
  },
  imageSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 10,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#22C55E',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  addImageText: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '600',
    marginLeft: 8,
  },
  imageGrid: {
    marginTop: 10,
  },
  imageContainer: {
    position: 'relative',
    margin: 2,
    width: (width - 60) / 3, // 3 columns with margins
    height: (width - 60) / 3,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ffffff',
    borderRadius: 10,
  },
});

export default MyPropertiesScreen;
