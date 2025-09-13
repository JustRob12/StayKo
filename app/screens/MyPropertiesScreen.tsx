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
  const [propertyPhotos, setPropertyPhotos] = useState<{[key: string]: string[]}>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
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
      
      // Load photos for each property
      const photosMap: {[key: string]: string[]} = {};
      for (const property of userProperties) {
        try {
          const photos = await propertyPhotosService.getPropertyPhotos(property.id);
          photosMap[property.id] = photos.map(photo => photo.photo_url);
        } catch (error) {
          console.error(`Error loading photos for property ${property.id}:`, error);
          photosMap[property.id] = [];
        }
      }
      setPropertyPhotos(photosMap);
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

  const openEditForm = async (property: Property) => {
    setEditingProperty(property);
    setFormData({
      type: property.type,
      title: property.title,
      description: property.description || '',
      price: property.price,
      location: property.location || '',
      latitude: property.latitude,
      longitude: property.longitude,
      contact_name: property.contact_name || '',
      contact_number: property.contact_number || '',
      contact_email: property.contact_email || '',
      status: property.status,
    });
    setSelectedLocation(
      property.latitude && property.longitude 
        ? { lat: property.latitude, lng: property.longitude }
        : null
    );
    setSelectedImages([]); // Clear any selected images for editing
    setImagesToDelete([]); // Clear images to delete
    
    // Fetch existing images for this property
    try {
      const photos = await propertyPhotosService.getPropertyPhotos(property.id);
      const photoUrls = photos.map(photo => photo.photo_url);
      setExistingImages(photoUrls);
    } catch (error) {
      console.error('Error fetching existing images:', error);
      setExistingImages([]);
    }
    
    setShowEditForm(true);
  };

  const closeEditForm = () => {
    setShowEditForm(false);
    setEditingProperty(null);
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
    setExistingImages([]);
    setImagesToDelete([]);
  };

  const handleUpdateProperty = async () => {
    if (!editingProperty?.id) return;

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
      // Update property in database
      const { data, error } = await propertiesService.updateProperty(editingProperty.id, {
        ...formData,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng
      });

      if (error) {
        throw new Error(error.message || 'Failed to update property');
      }

      // Handle image operations
      if (selectedImages.length > 0 || imagesToDelete.length > 0) {
        setUploadingImages(true);
        try {
          // Upload new images if any are selected
          if (selectedImages.length > 0) {
            const uploadPromises = selectedImages.map(imageUri => 
              uploadToCloudinary(imageUri).then(photoUrl => 
                propertyPhotosService.addPropertyPhoto(editingProperty.id, photoUrl)
              )
            );
            await Promise.all(uploadPromises);
          }

          // Delete marked images
          if (imagesToDelete.length > 0) {
            // Get all property photos to find the IDs of images to delete
            const allPhotos = await propertyPhotosService.getPropertyPhotos(editingProperty.id);
            const photosToDelete = allPhotos.filter(photo => 
              imagesToDelete.includes(photo.photo_url)
            );
            
            const deletePromises = photosToDelete.map(photo => 
              propertyPhotosService.deletePropertyPhoto(photo.id)
            );
            await Promise.all(deletePromises);
          }
        } catch (uploadError) {
          console.error('Error handling images:', uploadError);
          Alert.alert('Warning', 'Property updated but some image operations failed.');
        } finally {
          setUploadingImages(false);
        }
      }

      Alert.alert('Success', 'Property updated successfully!', [
        { text: 'OK', onPress: () => {
          closeEditForm();
          loadProperties(); // Reload properties list
        }}
      ]);
    } catch (error) {
      console.error('Error updating property:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update property');
    } finally {
      setLoading(false);
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return '#22C55E';
      case 'Unavailable': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const renderPropertyCard = ({ item }: { item: Property }) => {
    const photos = propertyPhotos[item.id] || [];
    const hasPhotos = photos.length > 0;
    
    return (
      <View style={styles.propertyCard}>
        <View style={styles.propertyImageContainer}>
          {hasPhotos ? (
            <Image 
              source={{ uri: photos[0] }} 
              style={styles.propertyImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.propertyImagePlaceholder}>
              <Ionicons name="home" size={40} color="#22C55E" />
            </View>
          )}
          <View style={styles.badgeContainer}>
            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) }]}>
              <Text style={styles.typeBadgeText}>{item.type.toUpperCase()}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusBadgeText}>{item.status}</Text>
            </View>
          </View>
          {hasPhotos && photos.length > 1 && (
            <View style={styles.photoCountBadge}>
              <Ionicons name="camera" size={12} color="#ffffff" />
              <Text style={styles.photoCountText}>+{photos.length - 1}</Text>
            </View>
          )}
        </View>
      
      <View style={styles.propertyInfo}>
        <Text style={styles.propertyTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.propertyLocation} numberOfLines={1}>
          <Ionicons name="location" size={14} color="#6B7280" /> {item.location || 'Location not specified'}
        </Text>
        <Text style={styles.propertyPrice}>{formatPrice(item.price)}</Text>
        
        <View style={styles.propertyActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => openPropertyModal(item)}
          >
            <Ionicons name="eye" size={16} color="#22C55E" />
            <Text style={styles.actionButtonText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => openEditForm(item)}
          >
            <Ionicons name="create" size={16} color="#3B82F6" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDeleteProperty(item)}
          >
            <Ionicons name="trash" size={16} color="#EF4444" />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    );
  };

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

  const removeExistingImage = (imageUrl: string) => {
    // Add to images to delete list
    setImagesToDelete(prev => [...prev, imageUrl]);
    // Remove from existing images display
    setExistingImages(prev => prev.filter(img => img !== imageUrl));
  };

  const restoreExistingImage = (imageUrl: string) => {
    // Remove from images to delete list
    setImagesToDelete(prev => prev.filter(img => img !== imageUrl));
    // Add back to existing images display
    setExistingImages(prev => [...prev, imageUrl]);
  };

  const handleDeleteProperty = async (property: Property) => {
    Alert.alert(
      'Delete Property',
      `Are you sure you want to delete "${property.title}"? This action cannot be undone and will also delete all associated images.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // First, get all photos for this property
              const photos = await propertyPhotosService.getPropertyPhotos(property.id);
              
              // Delete all property photos first
              if (photos.length > 0) {
                const deletePhotoPromises = photos.map(photo => 
                  propertyPhotosService.deletePropertyPhoto(photo.id)
                );
                await Promise.all(deletePhotoPromises);
                console.log(`Deleted ${photos.length} photos for property ${property.id}`);
              }
              
              // Then delete the property itself
              const { error } = await propertiesService.deleteProperty(property.id);
              
              if (error) {
                throw new Error(error.message || 'Failed to delete property');
              }
              
              Alert.alert('Success', 'Property and all associated images have been deleted successfully!');
              
              // Reload properties list
              loadProperties();
              
            } catch (error) {
              console.error('Error deleting property:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete property');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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
            <Text style={styles.title}> Add New Property</Text>
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

        {/* Property Status */}
        <View style={styles.section}>
          <Text style={styles.label}>Property Status *</Text>
          <View style={styles.typeContainer}>
            {(['Available', 'Unavailable'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.typeButton,
                  formData.status === status && styles.typeButtonActive
                ]}
                onPress={() => handleInputChange('status', status)}
              >
                <Text style={[
                  styles.typeButtonText,
                  formData.status === status && styles.typeButtonTextActive
                ]}>
                  {status}
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
          
          <Text style={styles.label}>Facebook Username</Text>
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
      {/* Header
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Properties</Text>
        <Text style={styles.headerSubtitle}>
          {properties.length} {properties.length === 1 ? 'property' : 'properties'} listed
        </Text>
      </View> */}

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
              <View style={styles.placeholder} />
            </View>

            {/* Image Carousel */}
            <View style={styles.imageCarousel}>
              {(() => {
                const photos = propertyPhotos[selectedProperty.id] || [];
                if (photos.length === 0) {
                  return (
                    <View style={styles.noImageContainer}>
                      <Ionicons name="home" size={60} color="#D1D5DB" />
                      <Text style={styles.noImageText}>No images available</Text>
                    </View>
                  );
                }
                
                return (
                  <>
                    <Image 
                      source={{ uri: photos[currentImageIndex] }} 
                      style={styles.modalImage}
                      resizeMode="cover"
                    />
                    
                    {/* Navigation Arrows */}
                    {photos.length > 1 && (
                      <>
                        <TouchableOpacity 
                          style={[styles.navArrow, styles.leftArrow]}
                          onPress={prevImage}
                        >
                          <Ionicons name="chevron-back" size={24} color="#ffffff" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.navArrow, styles.rightArrow]}
                          onPress={nextImage}
                        >
                          <Ionicons name="chevron-forward" size={24} color="#ffffff" />
                        </TouchableOpacity>
                      </>
                    )}
                    
                    {/* Image Counter */}
                    {photos.length > 1 && (
                      <View style={styles.imageCounter}>
                        <Text style={styles.imageCounterText}>
                          {currentImageIndex + 1} / {photos.length}
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>

            {/* Property Information */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.propertyDetails}>
                <View style={styles.propertyHeader}>
                  <Text style={styles.modalPropertyTitle}>{selectedProperty.title}</Text>
                  <View style={styles.modalBadgeContainer}>
                    <View style={[styles.modalTypeBadge, { backgroundColor: getTypeColor(selectedProperty.type) }]}>
                      <Text style={styles.modalTypeBadgeText}>{selectedProperty.type.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.modalStatusBadge, { backgroundColor: getStatusColor(selectedProperty.status) }]}>
                      <Text style={styles.modalStatusBadgeText}>{selectedProperty.status}</Text>
                    </View>
                  </View>
                </View>
                
                <Text style={styles.modalPropertyPrice}>{formatPrice(selectedProperty.price)}</Text>
                
                {selectedProperty.description && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{selectedProperty.description}</Text>
                  </View>
                )}
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>
                    {selectedProperty.location || 'Location not specified'}
                  </Text>
                </View>
                
                {(selectedProperty.latitude && selectedProperty.longitude) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Coordinates</Text>
                    <Text style={styles.detailValue}>
                      {selectedProperty.latitude.toFixed(6)}, {selectedProperty.longitude.toFixed(6)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Contact Information */}
              <View style={styles.contactSection}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                
                {selectedProperty.contact_name && (
                  <View style={styles.contactItem}>
                    <Ionicons name="person" size={20} color="#22C55E" />
                    <Text style={styles.contactText}>{selectedProperty.contact_name}</Text>
                  </View>
                )}
                
                {selectedProperty.contact_number && (
                  <TouchableOpacity style={styles.contactItem}>
                    <Ionicons name="call" size={20} color="#22C55E" />
                    <Text style={styles.contactText}>{selectedProperty.contact_number}</Text>
                  </TouchableOpacity>
                )}
                
                {selectedProperty.contact_email && (
                  <TouchableOpacity style={styles.contactItem}>
                    <Ionicons name="mail" size={20} color="#22C55E" />
                    <Text style={styles.contactText}>{selectedProperty.contact_email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Edit Property Modal */}
      <Modal
        visible={showEditForm}
        animationType="slide"
        onRequestClose={closeEditForm}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <View style={styles.formHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={closeEditForm}
              >
                <Ionicons name="arrow-back" size={24} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.title}>Edit Property</Text>
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

            {/* Property Status */}
            <View style={styles.section}>
              <Text style={styles.label}>Property Status *</Text>
              <View style={styles.typeContainer}>
                {(['Available', 'Unavailable'] as const).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.typeButton,
                      formData.status === status && styles.typeButtonActive
                    ]}
                    onPress={() => handleInputChange('status', status)}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      formData.status === status && styles.typeButtonTextActive
                    ]}>
                      {status}
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
              <Text style={styles.imageSubtext}>Manage your property photos</Text>
              
              {/* Existing Images */}
              {existingImages.length > 0 && (
                <View style={styles.existingImagesSection}>
                  <Text style={styles.existingImagesTitle}>Current Images ({existingImages.length})</Text>
                  <View style={styles.imageGrid}>
                    <FlatList
                      data={existingImages}
                      keyExtractor={(item, index) => `existing-${index}`}
                      numColumns={3}
                      scrollEnabled={false}
                      renderItem={({ item, index }) => (
                        <View style={styles.imageContainer}>
                          <Image source={{ uri: item }} style={styles.selectedImage} />
                          <TouchableOpacity 
                            style={styles.removeImageButton}
                            onPress={() => removeExistingImage(item)}
                          >
                            <Ionicons name="trash" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                  </View>
                </View>
              )}

              {/* Images to Delete (if any) */}
              {imagesToDelete.length > 0 && (
                <View style={styles.deletedImagesSection}>
                  <Text style={styles.deletedImagesTitle}>Images to Delete ({imagesToDelete.length})</Text>
                  <View style={styles.imageGrid}>
                    <FlatList
                      data={imagesToDelete}
                      keyExtractor={(item, index) => `delete-${index}`}
                      numColumns={3}
                      scrollEnabled={false}
                      renderItem={({ item, index }) => (
                        <View style={[styles.imageContainer, styles.deletedImageContainer]}>
                          <Image source={{ uri: item }} style={[styles.selectedImage, styles.deletedImage]} />
                          <TouchableOpacity 
                            style={styles.restoreImageButton}
                            onPress={() => restoreExistingImage(item)}
                          >
                            <Ionicons name="refresh" size={16} color="#22C55E" />
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                  </View>
                </View>
              )}
              
              {/* Add New Images */}
              <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                <Ionicons name="camera" size={24} color="#22C55E" />
                <Text style={styles.addImageText}>Add New Photos</Text>
              </TouchableOpacity>

              {/* New Images Preview */}
              {selectedImages.length > 0 && (
                <View style={styles.newImagesSection}>
                  <Text style={styles.newImagesTitle}>New Images ({selectedImages.length})</Text>
                  <View style={styles.imageGrid}>
                    <FlatList
                      data={selectedImages}
                      keyExtractor={(item, index) => `new-${index}`}
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

            {/* Update Button */}
            <TouchableOpacity 
              style={[styles.submitButton, (loading || uploadingImages) && styles.submitButtonDisabled]}
              onPress={handleUpdateProperty}
              disabled={loading || uploadingImages}
            >
              {loading || uploadingImages ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.submitButtonText}>
                    {uploadingImages ? 'Uploading Images...' : 'Updating Property...'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <Text style={styles.submitButtonText}>Update Property</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Map Modal for Edit */}
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
                <Text style={styles.mapTitle}>Update Property Location</Text>
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
      </Modal>
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
  propertyImage: {
    width: '100%',
    height: '100%',
  },
  propertyImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
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
  existingImagesSection: {
    marginBottom: 16,
  },
  existingImagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  deletedImagesSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deletedImagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
  },
  deletedImageContainer: {
    opacity: 0.6,
  },
  deletedImage: {
    opacity: 0.5,
  },
  restoreImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  newImagesSection: {
    marginTop: 16,
  },
  newImagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 5,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 24,
  },
  imageCarousel: {
    height: 300,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 10,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftArrow: {
    left: 15,
  },
  rightArrow: {
    right: 15,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  imageCounterText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 0,
  },
  propertyDetails: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 20,
    marginBottom: 0,
    flex: 1,
  },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalPropertyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  modalBadgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  modalTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalTypeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalStatusBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalPropertyPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
  },
  contactSection: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 20,
    marginBottom: 0,
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactText: {
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
    flex: 1,
  },
});

export default MyPropertiesScreen;
