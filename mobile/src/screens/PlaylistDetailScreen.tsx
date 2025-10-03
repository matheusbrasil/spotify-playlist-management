import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../services/api';
import type { PlaylistDetail, Track } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'PlaylistDetail'>;

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const PlaylistDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { playlistId } = route.params;
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(route.params.playlist ?? null);
  const [loading, setLoading] = useState(!route.params.playlist);

  const fetchPlaylist = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<PlaylistDetail>(`/playlists/${playlistId}`);
      setPlaylist(data);
    } catch (error) {
      console.error('Failed to load playlist details', error);
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  useEffect(() => {
    if (playlist) {
      navigation.setOptions({ title: playlist.name });
    }
  }, [navigation, playlist]);

  const genres = useMemo(() => {
    if (!playlist) return [] as Array<{ genre: string; count: number }>;
    const map = new Map<string, number>();
    playlist.tracks.forEach((track) => {
      const genre = track.genre ?? 'Unknown';
      map.set(genre, (map.get(genre) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([genre, count]) => ({ genre, count }));
  }, [playlist]);

  const renderTrack = ({ item }: { item: Track }) => (
    <View style={styles.track}>
      <Image
        source={{ uri: item.album.images?.[0]?.url }}
        style={styles.trackCover}
        resizeMode="cover"
      />
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle}>{item.name}</Text>
        <Text style={styles.trackArtists}>{item.artists.map((artist) => artist.name).join(', ')}</Text>
      </View>
      <View style={styles.trackMeta}>
        <Text style={styles.trackGenre}>{item.genre}</Text>
        <Text style={styles.trackDuration}>{formatDuration(item.durationMs)}</Text>
      </View>
    </View>
  );

  if (loading || !playlist) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{playlist.name}</Text>
        <Text style={styles.subtitle}>{playlist.trackCount} tracks</Text>
        <View style={styles.genreChips}>
          {genres.map((genre) => (
            <View key={genre.genre} style={styles.genreChip}>
              <Text style={styles.genreChipText}>
                {genre.genre} · {genre.count}
              </Text>
            </View>
          ))}
        </View>
        <Pressable
          style={styles.splitButton}
          onPress={() =>
            navigation.navigate('SmartSplit', {
              playlistId: playlist.id,
              playlistName: playlist.name,
            })
          }
        >
          <Text style={styles.splitButtonText}>Smart Split by Genre</Text>
        </Pressable>
      </View>
      <FlatList
        data={playlist.tracks}
        keyExtractor={(item) => item.id}
        renderItem={renderTrack}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#151515',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#888',
    marginTop: 4,
    fontSize: 14,
  },
  genreChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  genreChip: {
    backgroundColor: '#1DB95422',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreChipText: {
    color: '#1DB954',
    fontSize: 13,
  },
  splitButton: {
    marginTop: 16,
    backgroundColor: '#1DB954',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  splitButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  trackCover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  trackArtists: {
    color: '#aaa',
    marginTop: 4,
    fontSize: 13,
  },
  trackMeta: {
    alignItems: 'flex-end',
  },
  trackGenre: {
    color: '#1DB954',
    fontSize: 13,
  },
  trackDuration: {
    color: '#777',
    marginTop: 4,
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0b0b',
  },
});

export default PlaylistDetailScreen;
