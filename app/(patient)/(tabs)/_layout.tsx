import React, { useEffect } from 'react';
import { View, BackHandler } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useAuthStore } from '@/store/authStore';
import { usePharmacyStore } from '@/store/pharmacyStore';
import { useChatStore } from '@/store/chatStore';

const TAB_ROUTES = ['home', 'search', 'chat', 'profile'];

export default function TabsLayout() {
  const { theme, primaryColor } = useThemeContext();
  const router = useRouter();
  const pathname = usePathname();

  const { user } = useAuthStore();
  const { pharmacies, loading: pharmLoading, loadNearby } = usePharmacyStore();
  const { consultations, fetchConsultations } = useChatStore();

  // ── Background preload: warm up data for non-visible tabs on mount ──────────
  useEffect(() => {
    // Pharmacies (GPS-based, no auth needed). Guard against double-fire with home.tsx.
    if (pharmacies.length === 0 && !pharmLoading) {
      loadNearby();
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    // Chat consultations — preload once so Chat tab renders instantly
    if (consultations.length === 0) {
      fetchConsultations(user.id);
    }
  }, [user?.id]);


  // Find active tab index based on pathname
  let activeIndex = TAB_ROUTES.findIndex((route) => pathname.includes(route));
  if (activeIndex === -1) activeIndex = 0; // Default to home

  const navigateToTab = (index: number) => {
    if (index >= 0 && index < TAB_ROUTES.length) {
      router.navigate(`/(patient)/${TAB_ROUTES[index]}` as any);
    }
  };

  // Requirement 2: Gesture swipe left / right between patient tabs
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onEnd((e) => {
      const isHorizontal = Math.abs(e.translationX) > Math.abs(e.translationY);
      const isDistance = Math.abs(e.translationX) > 35;
      const isVelocity = Math.abs(e.velocityX) > 100;

      if (isHorizontal && (isDistance || isVelocity)) {
        if (e.translationX < 0) {
          // Swiped Left -> Move to Next Tab Right
          if (activeIndex < TAB_ROUTES.length - 1) {
            runOnJS(navigateToTab)(activeIndex + 1);
          }
        } else if (e.translationX > 0) {
          // Swiped Right -> Move to Previous Tab Left
          if (activeIndex > 0) {
            runOnJS(navigateToTab)(activeIndex - 1);
          }
        }
      }
    });

  // Requirement 3: Device Back Button returns to Home before exiting app
  useEffect(() => {
    const onBackPress = () => {
      const isHome = activeIndex === 0;
      if (!isHome) {
        router.navigate('/(patient)/home' as any);
        return true; // Handled back navigation to Home
      }
      return false; // Already on Home: allow device back to close app
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeIndex, router]);

  return (
    <GestureDetector gesture={panGesture}>
      <View collapsable={false} style={{ flex: 1 }}>
        <Tabs
          backBehavior="initialRoute"
          screenOptions={{
            tabBarActiveTintColor: primaryColor,
            tabBarInactiveTintColor: theme.textDim,
            tabBarHideOnKeyboard: true,
            animation: 'shift',
            tabBarStyle: {
              backgroundColor: theme.card,
              borderTopColor: theme.border,
              borderTopWidth: 1,
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
      </View>
    </GestureDetector>
  );
}
