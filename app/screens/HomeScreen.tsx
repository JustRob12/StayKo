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
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { propertiesService, propertyPhotosService, Property } from '../lib/properties';
import { favoritesService } from '../lib/favorites';
import { profilesService } from '../lib/profiles';

const { width } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [propertyPhotos, setPropertyPhotos] = useState<{[key: string]: string[]}>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Favorites state
  const [favoritePropertyIds, setFavoritePropertyIds] = useState<string[]>([]);
  
  // Property creator profile state
  const [propertyCreatorProfile, setPropertyCreatorProfile] = useState<any>(null);

  useEffect(() => {
    loadAllProperties();
    loadUserFavorites();
  }, []);

  useEffect(() => {
    filterProperties();
  }, [properties, searchQuery, selectedType, minPrice, maxPrice]);

  // Auto-refresh favorites when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserFavorites();
    }, [])
  );

  const loadAllProperties = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Load all properties
      const allProperties = await propertiesService.getAllProperties();
      setProperties(allProperties);
      
      // Load photos for each property
      const photosMap: {[key: string]: string[]} = {};
      for (const property of allProperties) {
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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterProperties = () => {
    let filtered = properties;

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(property =>
        property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        property.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        property.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(property => property.type === selectedType);
    }

    // Price range filter
    if (minPrice) {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        filtered = filtered.filter(property => property.price >= min);
      }
    }

    if (maxPrice) {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) {
        filtered = filtered.filter(property => property.price <= max);
      }
    }

    setFilteredProperties(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setMinPrice('');
    setMaxPrice('');
  };

  const loadUserFavorites = async () => {
    try {
      const favorites = await favoritesService.getUserFavorites();
      setFavoritePropertyIds(favorites);
    } catch (error) {
      console.error('Error loading user favorites:', error);
    }
  };

  const toggleFavorite = async (propertyId: string) => {
    try {
      const isFavorited = favoritePropertyIds.includes(propertyId);
      
      if (isFavorited) {
        // Remove from favorites
        const { error } = await favoritesService.removeFromFavorites(propertyId);
        if (error) {
          console.error('Error removing from favorites:', error);
          return;
        }
        setFavoritePropertyIds(prev => prev.filter(id => id !== propertyId));
      } else {
        // Add to favorites
        const { error } = await favoritesService.addToFavorites(propertyId);
        if (error) {
          console.error('Error adding to favorites:', error);
          return;
        }
        setFavoritePropertyIds(prev => [...prev, propertyId]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const onRefresh = async () => {
    await loadAllProperties(true);
    await loadUserFavorites();
  };

  const openPropertyModal = async (property: Property) => {
    setSelectedProperty(property);
    setCurrentImageIndex(0);
    setShowPropertyModal(true);
    
     // Load the property creator's profile
     try {
       const profile = await profilesService.getProfile(property.user_id);
       console.log('Loaded profile for user:', property.user_id, profile);
       setPropertyCreatorProfile(profile);
     } catch (error) {
       console.error('Error loading property creator profile:', error);
       setPropertyCreatorProfile(null);
     }
  };

  const closePropertyModal = () => {
    setShowPropertyModal(false);
    setSelectedProperty(null);
    setCurrentImageIndex(0);
    setPropertyCreatorProfile(null);
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
        {/* Left side - Property Image */}
        <View style={styles.propertyImageContainer}>
          {hasPhotos ? (
            <Image 
              source={{ uri: photos[0] }} 
              style={styles.propertyImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.propertyImagePlaceholder}>
              <Ionicons name="home" size={20} color="#22C55E" />
            </View>
          )}
          {hasPhotos && photos.length > 1 && (
            <View style={styles.photoCountBadge}>
              <Ionicons name="camera" size={10} color="#ffffff" />
              <Text style={styles.photoCountText}>+{photos.length - 1}</Text>
            </View>
          )}
        </View>

        {/* Center - Property Details */}
        <View style={styles.propertyDetails}>
          {/* Title */}
          <Text style={styles.propertyTitle} numberOfLines={2}>{item.title}</Text>
          
          {/* Price */}
          <Text style={styles.propertyPrice}>{formatPrice(item.price)}</Text>
          
          {/* Location */}
          <Text style={styles.propertyLocation} numberOfLines={1}>
            <Ionicons name="location" size={12} color="#6B7280" /> {item.location || 'Location not specified'}
          </Text>
          
          {/* Type and Status Badges */}
          <View style={styles.badgeContainer}>
            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) }]}>
              <Text style={styles.typeBadgeText}>{item.type.toUpperCase()}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusBadgeText}>{item.status}</Text>
            </View>
          </View>
        </View>

        {/* Right side - Action Buttons */}
        <View style={styles.actionButtons}>
          {/* View Button */}
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => openPropertyModal(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="eye" size={14} color="#22C55E" />
          </TouchableOpacity>
          
          {/* Favorite Heart Button */}
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={favoritePropertyIds.includes(item.id) ? "heart" : "heart-outline"} 
              size={14} 
              color={favoritePropertyIds.includes(item.id) ? "#EF4444" : "#6B7280"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>Loading properties...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search and Filter Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search properties..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="filter" size={20} color="#22C55E" />
          </TouchableOpacity>
        </View>
        
        {/* Filter Panel */}
        {showFilters && (
          <View style={styles.filterPanel}>
            {/* Property Type Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Property Type</Text>
              <View style={styles.typeFilterContainer}>
                {['all', 'rent', 'sale', 'boarding'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeFilterButton,
                      selectedType === type && styles.typeFilterButtonActive
                    ]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Text style={[
                      styles.typeFilterText,
                      selectedType === type && styles.typeFilterTextActive
                    ]}>
                      {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price Range Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Price Range (₱)</Text>
              <View style={styles.priceRangeContainer}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Min"
                  placeholderTextColor="#9CA3AF"
                  value={minPrice}
                  onChangeText={setMinPrice}
                  keyboardType="numeric"
                />
                <Text style={styles.priceRangeSeparator}>to</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Max"
                  placeholderTextColor="#9CA3AF"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Clear Filters Button */}
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Ionicons name="refresh" size={16} color="#6B7280" />
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Properties List */}
      {filteredProperties.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="home-outline" size={80} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Properties Available</Text>
          <Text style={styles.emptySubtitle}>
            Check back later for new property listings
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProperties}
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
              <View style={styles.modalPropertyDetails}>
                <View style={styles.propertyHeader}>
                  <Text style={styles.modalPropertyTitle}>{selectedProperty.title}</Text>
                </View>
                
                {/* Property Creator Information */}
                <View style={styles.ownerSection}>
                  <View style={styles.ownerInfo}>
                    <View style={styles.ownerAvatar}>
                      {propertyCreatorProfile?.avatar_url && propertyCreatorProfile.avatar_url.trim() !== '' ? (
                        <Image 
                          source={{ uri: propertyCreatorProfile.avatar_url }} 
                          style={styles.ownerAvatarImage}
                          resizeMode="cover"
                          onError={(error) => {
                            console.log('Image load error:', error);
                          }}
                          onLoad={() => {
                            console.log('Image loaded successfully');
                          }}
                        />
                      ) : (
                        <Ionicons name="person" size={20} color="#22C55E" />
                      )}
                    </View>
                    <View style={styles.ownerDetails}>
                      <Text style={styles.ownerLabel}>Property Creator</Text>
                      <Text style={styles.ownerName}>
                        {propertyCreatorProfile?.full_name || propertyCreatorProfile?.first_name || 'Creator not specified'}
                      </Text>
                      {/* {propertyCreatorProfile?.contactnumber && (
                        <Text style={styles.ownerContact}>
                          📞 {propertyCreatorProfile.contactnumber}
                        </Text>
                      )} */}
                    </View>
                  </View>
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
  // Search and Filter styles
  searchHeader: {
    backgroundColor: '#ffffff',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 4,
  },
  filterButton: {
    padding: 4,
  },
  filterPanel: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  typeFilterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeFilterButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  typeFilterButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  typeFilterText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  typeFilterTextActive: {
    color: '#ffffff',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#1F2937',
  },
  priceRangeSeparator: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  clearFiltersText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
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
    backgroundColor: '#F0FDF4',
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
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    flexDirection: 'row',
    height: 90,
  },
  propertyImageContainer: {
    position: 'relative',
    width: 80,
    height: 90,
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
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
  },
  photoCountText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '600',
    marginLeft: 1,
  },
  propertyDetails: {
    flex: 1,
    padding: 8,
    justifyContent: 'space-between',
  },
  actionButtons: {
    flexDirection: 'column',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 6,
    width: 45,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  typeBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
    lineHeight: 16,
  },
  propertyLocation: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 2,
  },
  viewButton: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 5,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  favoriteButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
     padding: 0,
   },
   modalPropertyDetails: {
     backgroundColor: '#ffffff',
     borderRadius: 0,
     padding: 20,
     marginBottom: 0,
     flex: 1,
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
  ownerSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#22C55E',
    overflow: 'hidden',
  },
  ownerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  ownerDetails: {
    flex: 1,
  },
  ownerLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  ownerName: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  ownerContact: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
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
     borderRadius: 0,
     padding: 20,
     marginBottom: 0,
     flex: 1,
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

export default HomeScreen;