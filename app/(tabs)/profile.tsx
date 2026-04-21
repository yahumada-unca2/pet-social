import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'likes'>('posts');

  const fetchProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Traer datos del perfil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!profileError && profileData) {
        setProfile(profileData);
      }

      // Traer los posts creados por este usuario
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, image_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!postsError && postsData) {
        setPosts(postsData);
      }

      // Obtener cantidad de Followers
      const { count: followersCountData } = await supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', user.id);
      
      setFollowersCount(followersCountData || 0);

      // Obtener cantidad de Following (a quiénes sigo)
      const { count: followingCountData } = await supabase
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      setFollowingCount(followingCountData || 0);

      // Traer los posts que le gustan a este usuario
      const { data: likesData, error: likesError } = await supabase
        .from('likes')
        .select('posts(id, image_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!likesError && likesData) {
        // Extraer los posts del objeto anidado
        const formattedLikes = likesData.map((l: any) => l.posts).filter(p => !!p);
        setLikedPosts(formattedLikes);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfileData();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#f53d3d" />
      </SafeAreaView>
    );
  }

  const avatarUrl = profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + (profile?.name || 'User');
  const coverUrl = 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop'; // Cover temporal hasta que agreguemos campos de background

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
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
          <View style={[styles.headerControls, { paddingTop: Math.max(insets.top, 16) }]}>
            <View style={{ width: 40 }} /> {/* Spacer */}
            <TouchableOpacity style={styles.iconButton} onPress={handleSignOut}>
              <MaterialIcons name="logout" size={24} color="#f53d3d" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfoContainer}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          </View>

          <Text style={styles.name}>{profile?.name || 'New User'}</Text>
          <Text style={styles.breedInfo}>My Pet Account</Text>
          <Text style={styles.bio}>
            {profile?.bio || 'No bio yet. Edit your profile to add one!'}
          </Text>

          <TouchableOpacity style={styles.editButton} onPress={() => router.push('/edit-profile')}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Posts Grid */}
        <View style={styles.postsSection}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'posts' && styles.activeTabIndicator]}
              onPress={() => setActiveTab('posts')}
            >   
              <MaterialIcons name="grid-on" size={24} color={activeTab === 'posts' ? '#f53d3d' : '#A8A8B3'} />      
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'likes' && styles.activeTabIndicator]}
              onPress={() => setActiveTab('likes')}
            >
              <MaterialIcons name={activeTab === 'likes' ? "favorite" : "favorite-border"} size={24} color={activeTab === 'likes' ? '#f53d3d' : '#A8A8B3'} />
            </TouchableOpacity>
          </View>

          <View style={styles.gridContainer}>
            {activeTab === 'posts' ? (
              posts.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#888', marginTop: 20, width: '100%' }}>No photos published yet.</Text>
              ) : (
                posts.map((post) => (
                  <TouchableOpacity key={post.id} style={styles.gridItem} onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.8}>
                    <Image source={{ uri: post.image_url }} style={styles.gridImage} />
                  </TouchableOpacity>
                ))
              )
            ) : (
              likedPosts.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#888', marginTop: 20, width: '100%' }}>No liked photos yet.</Text>
              ) : (
                likedPosts.map((post: any) => (
                  <TouchableOpacity key={post.id} style={styles.gridItem} onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.8}>
                    <Image source={{ uri: post.image_url }} style={styles.gridImage} />
                  </TouchableOpacity>
                ))
              )
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  coverContainer: {
    height: 192,
    position: 'relative',
    backgroundColor: '#FDCB6E',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerControls: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f53d3d',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  profileInfoContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: -60, // overlaps the cover
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#f53d3d',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginBottom: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  name: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D3436',
    letterSpacing: -0.5,
  },
  breedInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A8A8B3',
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: '#2D3436',
    marginTop: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  editButton: {
    marginTop: 24,
    backgroundColor: '#f53d3d',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 99,
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
    shadowColor: '#f53d3d',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  editButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 24,
    marginBottom: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A8A8B3',
  },
  postsSection: {
    marginTop: 24,
    width: '100%',
    paddingHorizontal: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f4e7e7',
    paddingVertical: 8,
    marginBottom: 4,
  },
  tabButton: {
    padding: 8,
  },
  activeTabIndicator: {
    borderBottomWidth: 2,
    borderBottomColor: '#f53d3d',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 2,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
});
