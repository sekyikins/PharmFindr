import React from 'react';
import { Tabs } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  const { theme, primaryColor } = useThemeContext();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: theme.textDim,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          elevation: 8,
          shadowOpacity: 0.1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
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
