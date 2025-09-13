import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Modal, 
  ScrollView, 
  RefreshControl,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { favoritesService } from '../lib/favorites';
import { propertyPhotosService, Property } from '../lib/properties';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

const SearchScreen: React.FC = () => {
  const [favoriteProperties, setFavoriteProperties] = useState<Property[]>([]);
  const [propertyPhotos, setPropertyPhotos] = useState<{[key: string]: string[]}>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    loadFavoriteProperties();
  }, []);

  // Auto-refresh favorites when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadFavoriteProperties();
    }, [])
  );

  const loadFavoriteProperties = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Load user's favorite properties
      const favorites = await favoritesService.getUserFavoriteProperties();
      setFavoriteProperties(favorites);
      
      // Load photos for each favorite property
      const photosMap: {[key: string]: string[]} = {};
      for (const property of favorites) {
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
      console.error('Error loading favorite properties:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    await loadFavoriteProperties(true);
  };

  const toggleFavorite = async (propertyId: string, propertyTitle: string) => {
    Alert.alert(
      'Remove from Favorites',
      `Are you sure you want to remove "${propertyTitle}" from your favorites?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from favorites
              const { error } = await favoritesService.removeFromFavorites(propertyId);
              if (error) {
                console.error('Error removing from favorites:', error);
                Alert.alert('Error', 'Failed to remove from favorites. Please try again.');
                return;
              }
              
              // Remove from local state
              setFavoriteProperties(prev => prev.filter(property => property.id !== propertyId));
              
              // Remove from property photos
              setPropertyPhotos(prev => {
                const updated = { ...prev };
                delete updated[propertyId];
                return updated;
              });
            } catch (error) {
              console.error('Error toggling favorite:', error);
              Alert.alert('Error', 'Failed to remove from favorites. Please try again.');
            }
          },
        },
      ]
    );
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
          
          {/* Favorite Heart Icon - Clickable to remove from favorites */}
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(item.id, item.title)}
            activeOpacity={0.7}
          >
            <Ionicons name="heart" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.propertyLocation} numberOfLines={1}>
            <Ionicons name="location" size={14} color="#6B7280" /> {item.location || 'Location not specified'}
          </Text>
          <Text style={styles.propertyPrice}>{formatPrice(item.price)}</Text>
          
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => openPropertyModal(item)}
          >
            <Ionicons name="eye" size={16} color="#ffffff" />
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>Loading your favorites...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header
      <View style={styles.header}>
        <Text style={styles.headerTitle}>❤️ My Favorites</Text>
        <Text style={styles.headerSubtitle}>
          {favoriteProperties.length} {favoriteProperties.length === 1 ? 'property' : 'properties'} saved
        </Text>
      </View> */}

      {/* Favorites List */}
      {favoriteProperties.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={80} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Favorites Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start exploring properties and add them to your favorites by tapping the heart icon
          </Text>
        </View>
      ) : (
        <FlatList
          data={favoriteProperties}
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

      {/* Property Detail Modal - Same as HomeScreen */}
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
                </View>
                
                <View style={styles.modalBadgeContainer}>
                  <View style={[styles.modalTypeBadge, { backgroundColor: getTypeColor(selectedProperty.type) }]}>
                    <Text style={styles.modalTypeBadgeText}>{selectedProperty.type.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.modalStatusBadge, { backgroundColor: getStatusColor(selectedProperty.status) }]}>
                    <Text style={styles.modalStatusBadgeText}>{selectedProperty.status}</Text>
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
    backgroundColor: '#F0FDF4',
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
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
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
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  viewButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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
    padding: 20,
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
  closeButton: {
    padding: 4,
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
    padding: 20,
  },
  propertyDetails: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyHeader: {
    marginBottom: 12,
  },
  modalPropertyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  modalBadgeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 15,
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

export default SearchScreen;