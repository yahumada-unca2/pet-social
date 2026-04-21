import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUpcomingFeatureInfo, setShowUpcomingFeatureInfo] = useState<string | null>(null);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          image_url,
          caption,
          created_at,
          profiles!posts_user_id_fkey (
            name,
            avatar_url
          ),
          likes (
            user_id
          ),
          comments (
            id
          )
        `)
        .eq('id', id)
        .single();

      if (!error && data) {
        setPost(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (postId: string, isLiked: boolean) => {
    if (!currentUserId || !post) return;
    
    let newLikes = [...(post.likes || [])];
    if (isLiked) {
      newLikes = newLikes.filter((like: any) => like.user_id !== currentUserId);
    } else {
      newLikes.push({ user_id: currentUserId });
    }
    setPost({ ...post, likes: newLikes });

    try {
      if (isLiked) {
        await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
      } else {
        await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
      }
    } catch (error) {
      fetchPost();
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Mira este post de ${profileName || 'alguien'} en Pet Social!\n\n${post.caption}\n\nhttps://petsocial.app/post/${post.id}`,
      });
      // result handling here...
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(error.message);
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  const deletePost = async () => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      
      setOptionsModalVisible(false);
      setShowDeleteConfirm(false);
      // Navegar hacia atrás porque este post ya no existe
      router.back();
    } catch (error: any) {
      console.error('Error:', error);
      if (Platform.OS === 'web') {
        window.alert('Hubo un problema al intentar eliminar el post: ' + error.message);
      } else {
        Alert.alert('Error', 'Hubo un problema al intentar eliminar el post.');
      }
    }
  };

  const handleMoreOptions = () => {
    if (!post) return;
    setShowDeleteConfirm(false);
    setShowUpcomingFeatureInfo(null);
    setOptionsModalVisible(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#f53d3d" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Post not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#f53d3d', fontSize: 16 }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const profileName = Array.isArray(post.profiles) ? post.profiles[0]?.name : post.profiles?.name;
  const profileAvatar = Array.isArray(post.profiles) ? post.profiles[0]?.avatar_url : post.profiles?.avatar_url;
  const isLiked = post.likes?.some((like: any) => like.user_id === currentUserId);
  const likesCount = post.likes ? post.likes.length : 0;
  const commentsCount = post.comments ? post.comments.length : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={28} color="#2D3436" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView>
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
            <TouchableOpacity style={styles.moreButton} onPress={handleMoreOptions}>
              <MaterialIcons name="more-horiz" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </TouchableOpacity>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: post.image_url }}
              style={styles.postImage}
            />
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
              <TouchableOpacity style={styles.sendButton} onPress={handleShare}>
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
      </ScrollView>

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
                    onPress={() => deletePost()}
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
              ) : post?.user_id === currentUserId ? (
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
  container: { flex: 1, backgroundColor: '#f8f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3436' },
  postCard: { backgroundColor: '#FFFFFF', paddingBottom: 16, marginTop: 8 },
  userInfo: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(245, 61, 61, 0.2)' },
  userInfoText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#2D3436' },
  postTime: { fontSize: 12, color: '#6b7280', fontWeight: '500', marginTop: 2 },
  moreButton: { padding: 8 },
  imageContainer: { paddingHorizontal: 0, marginTop: 8 },
  postImage: { width: '100%', height: 400, resizeMode: 'cover' },
  actionBar: { padding: 16 },
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  actionIconSpacing: { marginLeft: 16 },
  sendButton: { marginLeft: 'auto' },
  likesText: { fontWeight: 'bold', color: '#2D3436', marginBottom: 6 },
  captionText: { color: '#2D3436', lineHeight: 20, marginBottom: 6 },
  captionUser: { fontWeight: 'bold', color: '#2D3436' },
  viewCommentsText: { color: '#9ca3af', marginTop: 4 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalOptionText: { marginLeft: 12, fontSize: 16, color: '#2D3436' }
});