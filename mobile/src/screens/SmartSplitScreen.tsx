import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../services/api';
import type { CreatedPlaylist, CreateMixResponse, SmartSplitPreview } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface GenreOption {
  genre: string;
  trackCount: number;
  selected: boolean;
  uris: string[];
}

type Props = NativeStackScreenProps<RootStackParamList, 'SmartSplit'>;

const toTitleCase = (value: string): string =>
  value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const buildSuggestion = (playlistName: string, genres: string[]): string => {
  const trimmed = playlistName.trim();
  const base = trimmed.length ? trimmed : 'Playlist';
  if (!genres.length) {
    return base;
  }

  const formatted = genres.map(toTitleCase);
  if (formatted.length === 1) {
    return `${base} • ${formatted[0]}`;
  }
  if (formatted.length === 2) {
    return `${base} • ${formatted[0]} & ${formatted[1]}`;
  }
  if (formatted.length === 3) {
    return `${base} • ${formatted[0]}, ${formatted[1]} & ${formatted[2]}`;
  }
  return `${base} • ${formatted[0]}, ${formatted[1]} + More`;
};

const SmartSplitScreen: React.FC<Props> = ({ route }) => {
  const { playlistId, playlistName } = route.params;
  const [genreOptions, setGenreOptions] = useState<GenreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdPlaylist, setCreatedPlaylist] = useState<CreatedPlaylist | null>(null);
  const [mixName, setMixName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const fetchPreview = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<SmartSplitPreview>(`/smart-split/${playlistId}/preview`);
      const mapped = data.splits.map((split) => ({
        genre: split.genre,
        trackCount: split.trackCount,
        selected: true,
        uris: split.tracks.map((track) => track.uri),
      }));
      setGenreOptions(mapped);
      setNameEdited(false);
      setMixName(data.playlist.suggestedMixName ?? buildSuggestion(playlistName, mapped.map((option) => option.genre)));
      setCreatedPlaylist(null);
    } catch (error) {
      console.error('Failed to load smart split preview', error);
      Alert.alert('Unable to generate smart split', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [playlistId, playlistName]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const selectedOptions = useMemo(() => genreOptions.filter((option) => option.selected), [genreOptions]);

  const uniqueTrackCount = useMemo(() => {
    const set = new Set<string>();
    selectedOptions.forEach((option) => option.uris.forEach((uri) => set.add(uri)));
    return set.size;
  }, [selectedOptions]);

  useEffect(() => {
    if (!nameEdited) {
      setMixName((current) => {
        const suggestion = buildSuggestion(playlistName, selectedOptions.map((option) => option.genre));
        return current === suggestion ? current : suggestion;
      });
    }
  }, [selectedOptions, nameEdited, playlistName]);

  const toggleSelection = (index: number) => {
    setGenreOptions((current) =>
      current.map((option, idx) =>
        idx === index
          ? {
              ...option,
              selected: !option.selected,
            }
          : option,
      ),
    );
  };

  const handleNameChange = (text: string) => {
    setMixName(text);
    setNameEdited(true);
  };

  const handleCreate = async () => {
    if (!selectedOptions.length) {
      Alert.alert('Nothing selected', 'Enable at least one genre to create a playlist.');
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.post<CreateMixResponse>(`/smart-split/${playlistId}/create`, {
        genres: selectedOptions.map((option) => option.genre),
        name: mixName.trim() || undefined,
        makePublic: isPublic,
      });
      setCreatedPlaylist(data.playlist);
      Alert.alert('Playlist created', 'Your new playlist is now available on Spotify.');
    } catch (error) {
      console.error('Failed to create playlist from genres', error);
      Alert.alert('Creation failed', 'We could not create the playlist. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Select the genres to keep from {playlistName}</Text>
      <FlatList
        data={genreOptions}
        keyExtractor={(item) => item.genre}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.genre}>{item.genre}</Text>
              <Switch value={item.selected} onValueChange={() => toggleSelection(index)} />
            </View>
            <Text style={styles.trackCount}>{item.trackCount} tracks</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Selected genres</Text>
        <Text style={styles.summaryValue}>{selectedOptions.length}</Text>
        <Text style={styles.summaryLabel}>Tracks included</Text>
        <Text style={styles.summaryValue}>{uniqueTrackCount}</Text>
        <View style={styles.publicRow}>
          <Text style={styles.summaryLabel}>Make playlist public</Text>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>
        <TextInput
          style={styles.input}
          value={mixName}
          onChangeText={handleNameChange}
          placeholder="Playlist name"
          placeholderTextColor="#777"
        />
      </View>
      <Pressable style={styles.button} onPress={handleCreate} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Create New Playlist</Text>
        )}
      </Pressable>
      {createdPlaylist ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Created</Text>
          <Text style={styles.resultItem}>
            {createdPlaylist.name} • {createdPlaylist.trackCount} tracks
          </Text>
          {createdPlaylist.genres?.length ? (
            <Text style={styles.resultDetails}>
              Genres: {createdPlaylist.genres.map(toTitleCase).join(', ')}
            </Text>
          ) : null}
          <Text style={styles.resultDetails}>
            Visibility: {createdPlaylist.isPublic ? 'Public' : 'Private'}
          </Text>
          <Text style={styles.resultDetails}>
            Cover image generated: {createdPlaylist.coverImageSet ? 'Yes' : 'No'}
          </Text>
          {createdPlaylist.uri ? (
            <Text style={styles.resultDetails}>URI: {createdPlaylist.uri}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
    padding: 16,
  },
  subtitle: {
    color: '#aaa',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 120,
  },
  card: {
    backgroundColor: '#181818',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  genre: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  trackCount: {
    color: '#888',
    marginTop: 6,
  },
  summaryCard: {
    backgroundColor: '#181818',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  summaryLabel: {
    color: '#aaa',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  publicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    marginTop: 8,
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  button: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  resultContainer: {
    marginTop: 24,
    backgroundColor: '#151515',
    padding: 16,
    borderRadius: 16,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultItem: {
    color: '#ccc',
    marginTop: 4,
    fontSize: 14,
  },
  resultDetails: {
    color: '#888',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0b0b',
  },
});

export default SmartSplitScreen;
