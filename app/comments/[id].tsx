import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function CommentsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    fetchComments();
  }, [id]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          user_id,
          content,
          created_at,
          parent_id,
          profiles!comments_user_id_fkey (
            name,
            avatar_url
          )
        `)
        .eq('post_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No estás autenticado.');

      const { error } = await supabase.from('comments').insert({
        post_id: id,
        user_id: user.id,
        content: newComment.trim(),
        parent_id: replyTo ? replyTo.id : null,
      });

      if (error) throw error;

      setNewComment('');
      setReplyTo(null);
      fetchComments(); // Recargar comentarios
    } catch (error: any) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', error.message || 'No se pudo publicar el comentario.');
    } finally {
      setPosting(false);
    }
  };

  const renderComment = ({ item }: { item: any }) => {
    const profileName = Array.isArray(item.profiles) ? item.profiles[0]?.name : item.profiles?.name;
    const profileAvatar = Array.isArray(item.profiles) ? item.profiles[0]?.avatar_url : item.profiles?.avatar_url;

    return (
      <View style={[styles.commentRow, item.parent_id && styles.replyRow]}>
        <TouchableOpacity onPress={() => router.push(`/user/${item.user_id}`)}>
          <Image
            source={{ uri: profileAvatar || 'https://ui-avatars.com/api/?name=' + (profileName || 'User') }}
            style={styles.avatar}
          />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <Text style={styles.commentText}>
            <Text 
              onPress={() => router.push(`/user/${item.user_id}`)} 
              style={styles.username}
            >
              {profileName || 'Unknown User'}{' '}
            </Text>
            {item.content}
          </Text>
          <View style={styles.commentActions}>
            <Text style={styles.timeText}>{new Date(item.created_at).toLocaleDateString()}</Text>
            {!item.parent_id && (
              <TouchableOpacity onPress={() => setReplyTo({ id: item.id, name: profileName || 'User' })}>
                <Text style={styles.replyButtonText}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="close" size={28} color="#2D3436" />
        </TouchableOpacity>
        <Text style={styles.title}>Comments</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#f53d3d" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
            }
            contentContainerStyle={styles.listContent}
          />
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            {replyTo && (
              <View style={styles.replyingBanner}>
                <Text style={styles.replyingText}>Replying to {replyTo.name}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <MaterialIcons name="close" size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor="#9ca3af"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
          </View>
          <TouchableOpacity 
            style={styles.postButton} 
            onPress={handlePostComment}
            disabled={posting || !newComment.trim()}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#f53d3d" />
            ) : (
              <Text style={[styles.postButtonText, !newComment.trim() && styles.postButtonTextDisabled]}>
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  keyboardView: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  username: {
    fontWeight: 'bold',
    color: '#2D3436',
  },
  commentText: {
    fontSize: 14,
    color: '#2D3436',
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 16,
  },
  replyRow: {
    marginLeft: 32,
    marginTop: -8,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  replyButtonText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    overflow: 'hidden',
  },
  replyingBanner: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  replyingText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  input: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#2D3436',
  },
  postButton: {
    marginLeft: 12,
    padding: 8,
    alignSelf: 'flex-end',
  },
  postButtonText: {
    color: '#f53d3d',
    fontWeight: 'bold',
    fontSize: 16,
  },
  postButtonTextDisabled: {
    color: '#fca5a5',
  },
});