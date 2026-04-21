import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      if (user?.id === id) {
        // Si el usuario clickea su propio perfil, lo mandamos a su tab
        router.replace('/(tabs)/profile');
        return;
      }

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData);
      }

      // Fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, image_url')
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (!postsError && postsData) {
        setPosts(postsData);
      }

      // Check if following
      if (user) {
        const { data: followData } = await supabase
          .from('follows')
          .select('*')
          .match({ follower_id: user.id, following_id: id })
          .single();
        
        setIsFollowing(!!followData);
      }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [id]);

  const toggleFollow = async () => {
    if (!currentUserId) return;

    const previousState = isFollowing;
    setIsFollowing(!isFollowing);

    try {
      if (previousState) {
        await supabase
          .from('follows')
          .delete()
          .match({ follower_id: currentUserId, following_id: id });
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: id });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setIsFollowing(previousState);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#f53d3d" />
      </SafeAreaView>
    );
  }

  const avatarUrl = profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + (profile?.name || 'User');
  const coverUrl = 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f53d3d" />}
      >
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          <Image source={{ uri: coverUrl }} style={styles.coverImage} />        

          {/* Header Controls */}
          <View style={styles.headerControls}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#2D3436" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfoContainer}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          </View>

          <Text style={styles.name}>{profile?.name || 'User'}</Text>        
          <Text style={styles.breedInfo}>Pet Account</Text>
          <Text style={styles.bio}>
            {profile?.bio || 'No bio yet.'}       
          </Text>

          <TouchableOpacity 
            style={[styles.editButton, isFollowing ? styles.unfollowButton : styles.followButton]} 
            onPress={toggleFollow}
          >
            <Text style={[styles.editButtonText, isFollowing ? styles.unfollowButtonText : styles.followButtonText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
          </View>
        </View>

        {/* Posts Grid */}
        <View style={styles.postsSection}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity style={[styles.tabButton, styles.activeTabIndicator]}>     
              <MaterialIcons name="grid-on" size={24} color="#f53d3d" />        
            </TouchableOpacity>
          </View>

          <View style={styles.gridContainer}>
            {posts.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#888', marginTop: 20, width: '100%' }}>No photos published yet.</Text>
            ) : (
              posts.map((post) => (
                <TouchableOpacity key={post.id} style={styles.gridItem} onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.8}>
                  <Image source={{ uri: post.image_url }} style={styles.gridImage} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scrollContent: { paddingBottom: 24 },
  coverContainer: { height: 192, position: 'relative', backgroundColor: '#FDCB6E' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  headerControls: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  profileInfoContainer: { alignItems: 'center', paddingHorizontal: 24, marginTop: -60 },
  avatarContainer: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, borderColor: '#ffffff', backgroundColor: '#ffffff', overflow: 'hidden', shadowColor: '#f53d3d', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8, marginBottom: 12 },
  avatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  name: { fontSize: 32, fontWeight: 'bold', color: '#2D3436', letterSpacing: -0.5 },
  breedInfo: { fontSize: 16, fontWeight: '600', color: '#A8A8B3', marginTop: 4 },
  bio: { fontSize: 14, color: '#2D3436', marginTop: 12, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  editButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 99, width: '100%', maxWidth: 280, alignItems: 'center', borderWidth: 2 },
  followButton: { backgroundColor: '#f53d3d', borderColor: '#f53d3d', shadowColor: '#f53d3d', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  unfollowButton: { backgroundColor: '#ffffff', borderColor: '#e5e7eb' },
  editButtonText: { fontWeight: 'bold', fontSize: 18 },
  followButtonText: { color: '#ffffff' },
  unfollowButtonText: { color: '#4B5563' },
  statsContainer: { flexDirection: 'row', gap: 32, marginTop: 24, marginBottom: 8 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#2D3436' },
  statLabel: { fontSize: 14, fontWeight: '500', color: '#A8A8B3' },
  postsSection: { marginTop: 24, width: '100%', paddingHorizontal: 4 },
  tabsContainer: { flexDirection: 'row', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f4e7e7', paddingVertical: 8, marginBottom: 4 },
  tabButton: { padding: 8 },
  activeTabIndicator: { borderBottomWidth: 2, borderBottomColor: '#f53d3d' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '33.33%', aspectRatio: 1, padding: 2 },
  gridImage: { width: '100%', height: '100%', backgroundColor: '#e5e7eb' },
});