import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch and Mark as read
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        created_at,
        is_read,
        post_id,
        actor:profiles!notifications_actor_id_fkey (
          id,
          name,
          avatar_url
        ),
        post:posts (
          image_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setNotifications(data);
    }
    setLoading(false);

    // Mark as read in background
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
  };

  const renderNotification = ({ item }: { item: any }) => {
    const actor = item.actor || {};
    
    let text = '';
    let iconName = 'notifications';
    let iconColor = '#2D3436';

    if (item.type === 'like') {
      text = `liked your post.`;
      iconName = 'favorite';
      iconColor = '#f53d3d';
    } else if (item.type === 'comment') {
      text = `commented on your post.`;
      iconName = 'chat-bubble';
      iconColor = '#3498db';
    } else if (item.type === 'follow') {
      text = `started following you!`;
      iconName = 'person-add';
      iconColor = '#2ecc71';
    }

    return (
      <TouchableOpacity 
        style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
        onPress={() => {
          if (item.post_id) {
            router.push(`/post/${item.post_id}`);
          } else if (actor.id) {
            router.push(`/user/${actor.id}`);
          }
        }}
      >
        <Image 
          source={{ uri: actor.avatar_url || 'https://ui-avatars.com/api/?name=' + (actor.name || 'User') }} 
          style={styles.avatar} 
        />
        
        <View style={styles.textContainer}>
          <Text style={styles.notificationText}>
            <Text style={styles.actorName}>{actor.name || 'Someone'} </Text>
            {text}
          </Text>
          <Text style={styles.timeText}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>

        {!!item.post?.image_url && (
          <Image 
            source={{ uri: item.post.image_url }} 
            style={styles.postThumbnail} 
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={28} color="#2D3436" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#f53d3d" style={{ marginTop: 40 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="notifications-off" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3436' },
  backButton: { padding: 4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 16, fontSize: 16, color: '#6b7280' },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  unreadCard: {
    backgroundColor: '#fff0f0',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  textContainer: { flex: 1 },
  notificationText: { fontSize: 15, color: '#2D3436', lineHeight: 20 },
  actorName: { fontWeight: 'bold' },
  timeText: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  postThumbnail: { width: 44, height: 44, borderRadius: 6, marginLeft: 12 },
});