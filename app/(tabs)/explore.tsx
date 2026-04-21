import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      // Get current user to exclude them from suggestions
      const { data: { user } } = await supabase.auth.getUser();
      const authUserId = user?.id || null;
      setCurrentUserId(authUserId);

      if (!search.trim()) {
        // Usamos el algoritmo de Sugeridos por Afinidad o Fama
        const { data, error } = await supabase.rpc('get_suggested_friends', {
          p_user_id: authUserId,
          p_limit: 6
        });
        
        if (!error && data) setUsers(data);
      } else {
        // Búsqueda normal por nombre
        let query = supabase
          .from('profiles')
          .select('*, follows!following_id (follower_id)')
          .neq('id', authUserId)
          .ilike('name', `%${search}%`);

        const { data, error } = await query.limit(50);
        if (!error && data) setUsers(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Basic debounce for search
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const toggleFollow = async (profileId: string, isFollowing: boolean) => {
    if (!currentUserId) return;

    // Optimistic UI update
    setUsers(currentUsers => 
      currentUsers.map(u => {
        if (u.id === profileId) {
          let newFollows = [...(u.follows || [])];
          if (isFollowing) {
            newFollows = newFollows.filter(f => f.follower_id !== currentUserId);
          } else {
            newFollows.push({ follower_id: currentUserId, following_id: profileId });
          }
          return { ...u, follows: newFollows };
        }
        return u;
      })
    );

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .match({ follower_id: currentUserId, following_id: profileId });
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: profileId });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      fetchUsers(); // Revert
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <StatusBar style="dark" backgroundColor="#FFF8F0" />
      
      {/* Sticky Search Header */}
      <View style={[styles.searchHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={24} color="#A8A8B3" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Looking for Good Boys..."
            placeholderTextColor="#A8A8B3"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView 
        style={styles.scrollArea} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b6b" />}
      >
        <Text style={styles.title}>{search ? 'Search Results' : 'Suggested Friends'}</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#ff6b6b" style={{ marginTop: 40 }} />
        ) : users.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>No users found.</Text>
        ) : (
          <View style={styles.gridContainer}>
            {users.map((profile) => {
              const isFollowing = profile.follows?.some((f: any) => f.follower_id === currentUserId);
              return (
              <View key={profile.id} style={styles.card}>
                <TouchableOpacity 
                  style={{ alignItems: 'center' }}
                  onPress={() => router.push(`/user/${profile.id}`)}
                >
                  <View style={styles.avatarBorder}>
                    <Image 
                      source={{ uri: profile.avatar_url || 'https://ui-avatars.com/api/?name=' + (profile.name || 'User') }} 
                      style={styles.avatar} 
                    />
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{profile.name || 'Unknown'}</Text>
                  <Text style={styles.breed} numberOfLines={1}>{profile.bio || 'New User'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.button, isFollowing ? styles.followingButton : styles.followButton]}
                  onPress={() => toggleFollow(profile.id, !!isFollowing)}
                >
                  <Text style={[isFollowing ? styles.followingButtonText : styles.followButtonText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            )})}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0', // background-light
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFF8F0',
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // surface
    height: 56,
    borderRadius: 20, // rounded-input
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    // shadow-sm
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436', // text-main
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436', // text-main
    marginBottom: 24,
    marginLeft: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#FFFFFF', // surface
    width: '48%', // two columns with some gap
    borderRadius: 32, // rounded-card
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    // shadow-sm
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  avatarBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FDCB6E', // accent
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0', // fallback
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
    textAlign: 'center',
  },
  breed: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A8A8B3', // muted
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 99, // rounded-button
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButton: {
    backgroundColor: '#FF6B6B', // primary
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  followingButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#A8A8B3',
  },
  followingButtonText: {
    color: '#A8A8B3',
    fontWeight: '600',
    fontSize: 16,
  },
});
