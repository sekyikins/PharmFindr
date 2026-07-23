import React from 'react';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarStyle: { display: 'none' }, // Pharmacy uses card-based navigation from dashboard
      }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="inventory" />
      <Tabs.Screen name="reservations" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
