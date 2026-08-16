import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { usePharmacyStore } from '@/store/pharmacyStore';
import { useChatStore } from '@/store/chatStore';
import { FONT_SIZE } from '@/styles/theme';

export default function TabsLayout() {
  const { theme, primaryColor } = useThemeContext();

  const { user } = useAuthStore();
  const { pharmacies, loading: pharmLoading, loadNearby } = usePharmacyStore();
  const { consultations, fetchConsultations } = useChatStore();

  // Background preload data on mount
  useEffect(() => {
    if (pharmacies.length === 0 && !pharmLoading) {
      loadNearby();
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (consultations.length === 0) {
      fetchConsultations(user.id);
    }
  }, [user?.id]);

  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: theme.textDim,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: FONT_SIZE.sm,
          fontFamily: 'Inter-Bold',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
