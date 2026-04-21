import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Platform, RefreshControl, SafeAreaView, Share, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [newPostsPending, setNewPostsPending] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedType, setFeedType] = useState<'forYou' | 'following'>('forYou');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activePostOptions, setActivePostOptions] = useState<any>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUpcomingFeatureInfo, setShowUpcomingFeatureInfo] = useState<string | null>(null);

  const PAGE_SIZE = 10;

  // Get user only once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  const fetchPosts = async (type: 'initial' | 'refresh' | 'loadMore' = 'initial') => {
    if (type === 'initial') setLoading(true);
    if (type === 'refresh') setRefreshing(true);
    if (type === 'loadMore') setLoadingMore(true);

    try {
      let data: any[] | null = [];
      let error = null;

      const { data: { user } } = await supabase.auth.getUser();
      const authUserId = user?.id || null;

      if (feedType === 'forYou') {
        const payload = await supabase.rpc('get_recommended_posts', {
          p_user_id: authUserId,
          p_limit: PAGE_SIZE,
          p_offset: type === 'loadMore' ? posts.length : 0
        });
        
        data = payload.data;
        error = payload.error;
      } else {
        // En "Following" usamos la lógica base
        let query = supabase
          .from('posts')
          .select(`
            id, user_id, image_url, caption, created_at,
            profiles!posts_user_id_fkey (name, avatar_url),
            likes (user_id),
            comments (id)
          `);

        if (authUserId) {
          const { data: follows } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', authUserId);

          const followingIds = follows?.map(f => f.following_id) || [];
          
          if (followingIds.length === 0) {
            if (type !== 'loadMore') setPosts([]);
            setHasMore(false);
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
            return;
          }

          query = query.in('user_id', followingIds);
        }

        if (type === 'loadMore' && posts.length > 0) {
          const lastPost = posts[posts.length - 1];
          query = query.lt('created_at', lastPost.created_at);
        }

        const payload = await query.order('created_at', { ascending: false }).limit(PAGE_SIZE);
        data = payload.data;
        error = payload.error;
      }

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }
      
      if (data) {
        setHasMore(data.length === PAGE_SIZE);

        if (type === 'loadMore') {
          // Agregar al final
          setPosts(prev => {
            const newPosts = data.filter(apiPost => !prev.some(p => p.id === apiPost.id));
            return [...prev, ...newPosts];
          });
        } else {
          // Initial o refresh: reemplazar todo
          setPosts(data);
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      if (type === 'initial') setLoading(false);
      if (type === 'refresh') setRefreshing(false);
      if (type === 'loadMore') setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Cuando el userId ya cargó, fetcheamos initial posts
    if (currentUserId !== null) {
      if (posts.length === 0) {
        fetchPosts('initial');
      } else {
        // Al cambiar feedType limpiamos posts o los fetcheamos de nuevo si amerita
        fetchPosts('initial');
      }

      // Check inicial de notificaciones
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .eq('is_read', false)
        .then(({ count }) => {
          setHasUnreadNotifications((count || 0) > 0);
        });
    }

    // Suscripción en tiempo real a NUEVAS NOTIFICACIONES
    const notifsChannel = supabase
      .channel(`realtime_notifications_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          setHasUnreadNotifications(true);
        }
      )
      .subscribe();

    // Suscripción en tiempo real a NUEVOS POSTS
    const postsChannel = supabase
      .channel(`realtime_posts_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          // Si el post es del usuario actual, lo traemos con sus relaciones y lo insertamos arriba
          // Si es de otro usuario, solo mostramos un indicador para que refresque cuando quiera
          if (payload.new.user_id !== currentUserId) {
            setNewPostsPending(true);
          } else {
            setNewPostsPending(false);
            
            // Buscar el nuevo post con todas sus relaciones para agregarlo a la lista
            supabase
              .from('posts')
              .select(`
                id, user_id, image_url, caption, created_at,
                profiles!posts_user_id_fkey (name, avatar_url),
                likes (user_id),
                comments (id)
              `)
              .eq('id', payload.new.id)
              .single()
              .then(({ data, error }) => {
                if (data && !error) {
                  // Agregarlo inmediatamente al principio del estado sin recargar toda la lista
                  setPosts(prev => [data, ...prev]);
                  
                  // Dar tiempo a React para renderizar el nuevo elemento e ir al top
                  setTimeout(() => {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                  }, 100);
                } else {
                  // Fallback por si falló la búsqueda
                  fetchPosts('initial');
                }
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifsChannel);
      supabase.removeChannel(postsChannel);
    };
  }, [feedType, currentUserId]);

  const toggleLike = async (postId: string, isLiked: boolean) => {
    if (!currentUserId) return;

    // Optimistic UI update
    setPosts(currentPosts => 
      currentPosts.map(post => {
        if (post.id === postId) {
          let newLikes = [...(post.likes || [])];
          if (isLiked) {
            newLikes = newLikes.filter(like => like.user_id !== currentUserId);
          } else {
            newLikes.push({ user_id: currentUserId });
          }
          return { ...post, likes: newLikes };
        }
        return post;
      })
    );

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .match({ post_id: postId, user_id: currentUserId });
      } else {
        await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: currentUserId });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert if error
      fetchPosts();
    }
  };

  const onRefresh = () => {
    fetchPosts('refresh');
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore && posts.length > 0) {
      fetchPosts('loadMore');
    }
  };

  const handleShare = async (post: any) => {
    try {
      const result = await Share.share({
        message: `Mira este post de ${post.profiles?.name || 'alguien'} en Pet Social!\n\n${post.caption}\n\nhttps://petsocial.app/post/${post.id}`,
      });
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(error.message);
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      
      // Eliminar el post del estado local directamente para feedback inmediato
      setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
      
      // Cerrar modal
      setOptionsModalVisible(false);
      setActivePostOptions(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error:', error);
      if (Platform.OS === 'web') {
        window.alert('Hubo un problema al intentar eliminar el post.');
      } else {
        Alert.alert('Error', 'Hubo un problema al intentar eliminar el post.');
      }
    }
  };

  const confirmDeletePost = (postId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que quieres eliminar esta publicación?')) {
        deletePost(postId);
      }
    } else {
      Alert.alert(
        "Confirmar eliminación",
        "¿Estás seguro de que quieres eliminar esta publicación?",
        [
          { text: "No", style: "cancel" },
          { text: "Sí, Eliminar", style: "destructive", onPress: () => deletePost(postId) }
        ]
      );
    }
  };

  const handleMoreOptions = (post: any) => {
    setActivePostOptions(post);
    setShowDeleteConfirm(false);
    setShowUpcomingFeatureInfo(null);
    setOptionsModalVisible(true);
  };

  const renderPost = ({ item: post }: { item: any }) => {
    const profileName = Array.isArray(post.profiles) ? post.profiles[0]?.name : post.profiles?.name;
    const profileAvatar = Array.isArray(post.profiles) ? post.profiles[0]?.avatar_url : post.profiles?.avatar_url;
    const isLiked = post.likes?.some((like: any) => like.user_id === currentUserId);
    const likesCount = post.likes ? post.likes.length : 0;
    const commentsCount = post.comments ? post.comments.length : 0;

    return (
      <View style={styles.postCard}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => router.push(`/user/${post.user_id}`)}
        >
          <Image
            source={{ uri: profileAvatar || 'https://ui-avatars.com/api/?name=' + (profileName || 'User') }}
            style={styles.avatar}
          />
          <View style={styles.userInfoText}>
            <Text style={styles.name}>{profileName || 'Unknown User'}</Text>
            <Text style={styles.postTime}>{new Date(post.created_at).toLocaleDateString()}</Text>
          </View>
          <TouchableOpacity style={styles.moreButton} onPress={() => handleMoreOptions(post)}>
            <MaterialIcons name="more-horiz" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </TouchableOpacity>
        <View style={styles.imageContainer}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/post/${post.id}`)}>
              <Image
              source={{ uri: post.image_url }}
              style={styles.postImage}
            />
            </TouchableOpacity>
        </View>
        <View style={styles.actionBar}>
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity onPress={() => toggleLike(post.id, !!isLiked)}>
              <MaterialIcons 
                name={isLiked ? "favorite" : "favorite-border"} 
                size={28} 
                color={isLiked ? "#f53d3d" : "#2D3436"} 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconSpacing} onPress={() => router.push(`/comments/${post.id}`)}>
              <MaterialIcons name="chat-bubble-outline" size={26} color="#2D3436" />
            </TouchableOpacity>
            {/* Botón de compartir oculto temporalmente en entorno local
            <TouchableOpacity style={styles.sendButton} onPress={() => handleShare(post)}>
              <MaterialIcons name="send" size={24} color="#2D3436" />
            </TouchableOpacity>
            */}
          </View>
          <Text style={styles.likesText}>{likesCount} Likes</Text>
          <Text style={styles.captionText}>
            <Text style={styles.captionUser}>{profileName || 'User'} </Text>
            {post.caption}
          </Text>
          <TouchableOpacity onPress={() => router.push(`/comments/${post.id}`)}>
            <Text style={styles.viewCommentsText}>
              {commentsCount > 0 ? `View all ${commentsCount} comments...` : 'Add a comment...'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pet Social</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity style={styles.notificationButton} onPress={() => router.push('/create')}>
            <MaterialIcons name="add-box" size={28} color="#2D3436" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.notificationButton} 
            onPress={() => {
              setHasUnreadNotifications(false);
              router.push('/notifications');
            }}
          >
            <MaterialIcons name="notifications-none" size={28} color="#2D3436" />
            {hasUnreadNotifications && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.feedToggleContainer}>
        <TouchableOpacity 
          style={[styles.feedToggleButton, feedType === 'forYou' && styles.feedToggleButtonActive]}
          onPress={() => setFeedType('forYou')}
        >
          <Text style={[styles.feedToggleText, feedType === 'forYou' && styles.feedToggleTextActive]}>For You</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.feedToggleButton, feedType === 'following' && styles.feedToggleButtonActive]}
          onPress={() => setFeedType('following')}
        >
          <Text style={[styles.feedToggleText, feedType === 'following' && styles.feedToggleTextActive]}>Following</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {newPostsPending && (
          <View style={styles.newPostsIndicatorContainer}>
            <TouchableOpacity 
              style={styles.newPostsSimplePill}
              activeOpacity={0.9}
              onPress={() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                setNewPostsPending(false);
                fetchPosts('initial');
              }}
            >
              <MaterialIcons name="arrow-upward" size={16} color="#fff" />
              <Text style={styles.newPostsSimpleText}>Nuevas publicaciones</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f53d3d" />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          initialNumToRender={5}
        ListHeaderComponent={() => loading ? (
          <ActivityIndicator size="large" color="#f53d3d" style={{ marginTop: 40 }} />
        ) : posts.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: '#6b7280', fontSize: 16 }}>No posts yet. Be the first to share!</Text>
          </View>
        ) : null}
        ListFooterComponent={() => loadingMore ? (
          <ActivityIndicator size="small" color="#f53d3d" style={{ marginVertical: 20 }} />
        ) : null}
      />
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/create')}>
        <MaterialIcons name="add" size={32} color="white" />
      </TouchableOpacity>

      <Modal
        visible={optionsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setOptionsModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              
              {showUpcomingFeatureInfo ? (
                <View style={{ width: '100%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 }}>
                  <MaterialIcons name="construction" size={48} color="#3B82F6" style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2D3436', marginBottom: 8 }}>Próximamente</Text>
                  <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
                    {showUpcomingFeatureInfo}
                  </Text>
                  
                  <TouchableOpacity 
                    style={[styles.modalOption, { justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, marginBottom: 8, width: '100%', borderBottomWidth: 0 }]}
                    onPress={() => {
                      setShowUpcomingFeatureInfo(null);
                      setOptionsModalVisible(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: '#3B82F6', fontWeight: 'bold' }]}>Entendido</Text>
                  </TouchableOpacity>
                </View>
              ) : showDeleteConfirm ? (
                <View style={{ width: '100%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 }}>
                  <MaterialIcons name="warning-amber" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2D3436', marginBottom: 8 }}>¿Eliminar publicación?</Text>
                  <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
                    Esta acción no se puede deshacer.
                  </Text>
                  
                  <TouchableOpacity 
                    style={[styles.modalOption, { justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, marginBottom: 8, width: '100%', borderBottomWidth: 0 }]}
                    onPress={() => deletePost(activePostOptions.id)}
                  >
                    <Text style={[styles.modalOptionText, { color: '#EF4444', fontWeight: 'bold' }]}>Sí, eliminar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalOption, { justifyContent: 'center', borderBottomWidth: 0, width: '100%' }]}
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text style={[styles.modalOptionText, { color: '#6B7280', fontWeight: '600' }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              ) : activePostOptions?.user_id === currentUserId ? (
                <>
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => setShowDeleteConfirm(true)}
                  >
                    <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
                    <Text style={[styles.modalOptionText, { color: '#EF4444' }]}>Eliminar publicación</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => setShowUpcomingFeatureInfo('La funcionalidad de denuncias estará disponible en la próxima actualización.')}
                  >
                    <MaterialIcons name="report-problem" size={24} color="#EF4444" />
                    <Text style={[styles.modalOptionText, { color: '#EF4444' }]}>Denunciar post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => setShowUpcomingFeatureInfo('La funcionalidad de silenciar cuentas estará disponible muy pronto.')}
                  >
                    <MaterialIcons name="volume-off" size={24} color="#2D3436" />
                    <Text style={styles.modalOptionText}>Silenciar usuario</Text>
                  </TouchableOpacity>
                </>
              )}
              
              {!showDeleteConfirm && !showUpcomingFeatureInfo && (
                <TouchableOpacity 
                  style={[styles.modalOption, { borderBottomWidth: 0 }]}
                  onPress={() => setOptionsModalVisible(false)}
                >
                  <MaterialIcons name="close" size={24} color="#6B7280" />
                  <Text style={[styles.modalOptionText, { color: '#6B7280' }]}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  feedToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  feedToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  feedToggleButtonActive: {
    borderBottomColor: '#f53d3d',
  },
  feedToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  feedToggleTextActive: {
    color: '#f53d3d',
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    backgroundColor: '#f53d3d',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  newPostsIndicatorContainer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
    elevation: 10,
  },
  newPostsSimplePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f53d3d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  newPostsSimpleText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(245, 61, 61, 0.2)',
  },
  userInfoText: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  postTime: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  imageContainer: {
    paddingHorizontal: 12,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
  },
  actionBar: {
    padding: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIconSpacing: {
    marginLeft: 16,
  },
  sendButton: {
    marginLeft: 'auto',
  },
  likesText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  captionText: {
    fontSize: 14,
    color: '#2D3436',
    lineHeight: 20,
  },
  captionUser: {
    fontWeight: 'bold',
  },
  viewCommentsText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 6,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f53d3d',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#f53d3d',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32, // Para el área segura en iPhone
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#2D3436',
  },
});
