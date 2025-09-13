import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import MapScreen from './screens/MapScreen';
import MyPropertiesScreen from './screens/MyPropertiesScreen';
import ProfileScreen from './screens/ProfileScreen';
import NetworkWarning from './components/NetworkWarning';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function Header() {
  const { user, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  
  const handleLogout = async () => {
    setShowDropdown(false);
    await signOut();
  };

  const handleSettings = () => {
    setShowDropdown(false);
    // Navigate to settings screen (you can implement this later)
    console.log('Navigate to settings');
  };
  
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>StayKo</Text>
          <Text style={styles.headerSlogan}>Where your next home begins</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileContainer}
          onPress={() => setShowDropdown(!showDropdown)}
          activeOpacity={0.7}
        >
        {user?.user_metadata?.avatar_url ? (
          <Image 
            source={{ uri: user.user_metadata.avatar_url }} 
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.profilePlaceholder}>
            <Ionicons name="person" size={20} color="#22C55E" />
          </View>
        )}
      </TouchableOpacity>
      </View>

      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdown}>
            <TouchableOpacity 
              style={styles.dropdownItem}
              onPress={handleSettings}
            >
              <Ionicons name="settings-outline" size={20} color="#374151" />
              <Text style={styles.dropdownText}>Settings</Text>
            </TouchableOpacity>
            
            <View style={styles.dropdownDivider} />
            
            <TouchableOpacity 
              style={styles.dropdownItem}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={[styles.dropdownText, styles.logoutText]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <View style={styles.container}>
      <Header />
      <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
          position: 'absolute',
        },
        tabBarActiveTintColor: '#22C55E',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'MyProperties') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{
          tabBarLabel: 'Favourite',
        }}
      />
      <Tab.Screen 
        name="Map" 
        component={MapScreen}
        options={{
          tabBarLabel: 'Map',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={styles.centerButton}>
              <Ionicons 
                name={focused ? 'map' : 'map'} 
                size={28} 
                color="#22C55E" 
              />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
        }}
      />
      <Tab.Screen 
        name="MyProperties" 
        component={MyPropertiesScreen}
        options={{
          tabBarLabel: 'My List',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
    </View>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
      <NetworkWarning />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 2,
  },
  headerSlogan: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profilePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 20,
  },
  dropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    fontWeight: '500',
  },
  logoutText: {
    color: '#EF4444',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    elevation: 8,
    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 4,
    borderColor: '#22C55E',
  },
});
