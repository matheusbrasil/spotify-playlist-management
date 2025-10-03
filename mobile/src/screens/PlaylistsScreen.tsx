import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../services/api';
import type { PlaylistSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface UserProfile {
  id: string;
  name: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Playlists'>;

const PlaylistsScreen: React.FC<Props> = ({ navigation }) => {
  const { logout } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [playlistsResponse, userResponse] = await Promise.all([
        api.get<PlaylistSummary[]>('/playlists'),
        api.get<UserProfile>('/users/me'),
      ]);
      setPlaylists(playlistsResponse.data);
      setUser(userResponse.data);
    } catch (error) {
      console.error('Failed to load playlists', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const renderItem = ({ item }: { item: PlaylistSummary }) => {
    const image = item.images?.[0]?.url;
    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
      >
        {image ? <Image source={{ uri: image }} style={styles.cover} /> : <View style={styles.placeholder} />}
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {item.trackCount} tracks • {item.owner.name}
          </Text>
          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome{user ? `, ${user.name}` : ''}</Text>
          <Text style={styles.subtitle}>Choose a playlist to review its tracks and genres.</Text>
        </View>
        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#1DB954" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No playlists found.</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#444',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#181818',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#2b2b2b',
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: '#888',
    marginTop: 4,
    fontSize: 14,
  },
  description: {
    color: '#aaa',
    marginTop: 4,
    fontSize: 13,
  },
  emptyState: {
    marginTop: 120,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
});

export default PlaylistsScreen;
