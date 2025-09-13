import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  TextInput, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { profilesService, Profile } from '../lib/profiles';

const ProfileScreen: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileData, setProfileData] = useState({
    fullName: '',
    contactnumber: '',
  });

  // Load profile data when component mounts
  useEffect(() => {
    if (user?.id) {
      loadProfile();
    }
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      console.log('Loading profile for user:', user.id);
      const profileData = await profilesService.getProfile(user.id);
      console.log('Profile data loaded:', profileData);
      
      if (profileData) {
        setProfile(profileData);
        setProfileData({
          fullName: profileData.full_name || '',
          contactnumber: profileData.contactnumber || '',
        });
      } else {
        console.log('No profile found, creating initial profile');
        // Create profile if it doesn't exist
        await createInitialProfile();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const createInitialProfile = async () => {
    if (!user?.id) return;
    
    const initialProfile: Profile = {
      id: user.id,
      full_name: user.user_metadata?.full_name || '',
      phone: '',
      contactnumber: '',
      avatar_url: user.user_metadata?.avatar_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await profilesService.createProfile(initialProfile);
    if (data && !error) {
      setProfile(data);
      setProfileData({
        fullName: data.full_name || '',
        contactnumber: data.contactnumber || '',
      });
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadToCloudinary(result.assets[0].uri);
    }
  };

  const uploadToCloudinary = async (imageUri: string) => {
    setLoading(true);
    try {
      // Check if environment variables are set
      const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      
      if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary configuration missing. Please check your .env file.');
      }

      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);
      formData.append('upload_preset', uploadPreset);

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      
      console.log('Uploading to:', uploadUrl);
      console.log('Upload preset:', uploadPreset);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload response error:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Upload response:', data);
      
      if (data.secure_url) {
        // Update profile in database with new image URL
        if (user?.id) {
          const { error } = await profilesService.updateProfile(user.id, { 
            avatar_url: data.secure_url 
          });
          if (error) {
            throw new Error('Failed to update profile: ' + error.message);
          }
          
          // Also update user metadata for backward compatibility
          await updateUser({ avatar_url: data.secure_url });
          
          // Reload profile data
          await loadProfile();
        }
        Alert.alert('Success', 'Profile picture updated successfully!');
      } else {
        throw new Error('No secure URL returned from Cloudinary');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Update profile in database
      const { error } = await profilesService.updateProfile(user.id, {
        full_name: profileData.fullName,
        contactnumber: profileData.contactnumber,
      });

      if (error) {
        throw new Error('Failed to update profile: ' + error.message);
      }

      // Also update user metadata for backward compatibility
      await updateUser({ 
        full_name: profileData.fullName,
        contactnumber: profileData.contactnumber
      });

      // Reload profile data
      await loadProfile();
      
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', `Failed to update profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          {(profile?.avatar_url || user?.user_metadata?.avatar_url) ? (
            <Image 
              source={{ uri: profile?.avatar_url || user?.user_metadata?.avatar_url }} 
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={40} color="#22C55E" />
            </View>
          )}
          <TouchableOpacity 
            style={styles.cameraButton}
            onPress={pickImage}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="camera" size={16} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
        
        <Text style={styles.userName}>
          {profile?.full_name || user?.user_metadata?.full_name || 'User Name'}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Profile Details */}
      <View style={styles.detailsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <TouchableOpacity 
            onPress={() => setIsEditing(!isEditing)}
            style={styles.editButton}
          >
            <Ionicons 
              name={isEditing ? "close" : "pencil"} 
              size={20} 
              color="#22C55E" 
            />
            <Text style={styles.editButtonText}>
              {isEditing ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailItem}>
          <View style={styles.detailIcon}>
            <Ionicons name="person-outline" size={20} color="#22C55E" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Full Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.textInput}
                value={profileData.fullName}
                onChangeText={(text) => setProfileData({...profileData, fullName: text})}
                placeholder="Enter your full name"
              />
            ) : (
              <Text style={styles.detailValue}>
                {profile?.full_name || user?.user_metadata?.full_name || 'Not provided'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.detailItem}>
          <View style={styles.detailIcon}>
            <Ionicons name="mail-outline" size={20} color="#22C55E" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.detailItem}>
          <View style={styles.detailIcon}>
            <Ionicons name="call-outline" size={20} color="#22C55E" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Contact Number</Text>
            {isEditing ? (
              <TextInput
                style={styles.textInput}
                value={profileData.contactnumber}
                onChangeText={(text) => setProfileData({...profileData, contactnumber: text})}
                placeholder="Enter your contact number"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.detailValue}>
                {profile?.contactnumber || user?.user_metadata?.contactnumber || 'Not provided'}
              </Text>
            )}
          </View>
        </View>

        {isEditing && (
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Account Actions */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity style={styles.actionItem}>
          <View style={styles.actionIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#22C55E" />
          </View>
          <Text style={styles.actionText}>Privacy & Security</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem}>
          <View style={styles.actionIcon}>
            <Ionicons name="notifications-outline" size={20} color="#22C55E" />
          </View>
          <Text style={styles.actionText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem}>
          <View style={styles.actionIcon}>
            <Ionicons name="help-circle-outline" size={20} color="#22C55E" />
          </View>
          <Text style={styles.actionText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#22C55E',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#22C55E',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6B7280',
  },
  detailsSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
  },
  editButtonText: {
    fontSize: 14,
    color: '#22C55E',
    marginLeft: 4,
    fontWeight: '600',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  textInput: {
    fontSize: 16,
    color: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#22C55E',
    paddingVertical: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionsSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 100,
    borderRadius: 16,
    padding: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
});

export default ProfileScreen;
