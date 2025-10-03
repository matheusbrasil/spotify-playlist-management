import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import PlaylistsScreen from '../screens/PlaylistsScreen';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import SmartSplitScreen from '../screens/SmartSplitScreen';
import type { PlaylistDetail, SplitRecommendation } from '../types';

export type RootStackParamList = {
  Playlists: undefined;
  PlaylistDetail: { playlistId: string; playlist?: PlaylistDetail };
  SmartSplit: {
    playlistId: string;
    playlistName: string;
    splits?: SplitRecommendation[];
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <AuthStack.Navigator>
        <AuthStack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      </AuthStack.Navigator>
    );
  }

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Playlists"
        component={PlaylistsScreen}
        options={{ title: 'Your Playlists' }}
      />
      <Stack.Screen
        name="PlaylistDetail"
        component={PlaylistDetailScreen}
        options={({ route }) => ({ title: route.params.playlist?.name ?? 'Playlist' })}
      />
      <Stack.Screen
        name="SmartSplit"
        component={SmartSplitScreen}
        options={({ route }) => ({ title: `${route.params.playlistName} - Smart Split` })}
      />
    </Stack.Navigator>
  );
};
