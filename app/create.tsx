import { MaterialIcons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { supabase } from '../lib/supabase';

export default function CreatePostScreen() {
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const handleSelectImage = async () => {
    // Pedir permisos en dispositivos nativos
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos permisos para acceder a tus fotos.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
      base64: true, // Importante para subir a Supabase más fácilmente
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const handlePublish = async () => {
    if (!image) {
      Alert.alert('Falta imagen', 'Por favor selecciona una foto de tu mascota primero.');
      return;
    }

    setLoading(true);

    try {
      // 1. Obtener el usuario actual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) throw new Error('No estás autenticado');
      const user = session.user;

      // 2. Subir imagen a Supabase Storage
      let uploadUrl = '';
      if (image.base64) {
        // En la web, el URI puede ser un blob o data URI, así que mejor usamos el mimeType
        const ext = image.mimeType ? image.mimeType.split('/')[1] : 'jpeg';
        const fileExt = ext === 'undefined' ? 'jpeg' : ext; // fallback de seguridad
        
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post_images')
          .upload(filePath, decode(image.base64), {
            contentType: `image/${fileExt}`,
            upsert: false
          });

        if (uploadError) {
          console.error("Error completo de Storage:", uploadError);
          throw new Error(uploadError.message || "Las políticas (RLS) en el Bucket podrían estar bloqueando la subida.");
        }

        // Obtener la URL pública de la imagen
        const { data: publicUrlData } = supabase.storage
          .from('post_images')
          .getPublicUrl(filePath);

        uploadUrl = publicUrlData.publicUrl;
      } else {
        throw new Error('No se pudo obtener el formato base64 de la imagen.');
      }

      // 3. Insertar el post en la base de datos
      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        image_url: uploadUrl,
        caption: caption,
      });

      if (insertError) {
        console.error("Error al insertar post:", insertError);
        throw new Error(insertError.message || "Error al conectar con la base de datos de Posts.");
      }

      // 4. Volver al Feed si todo salió bien
      router.back();
      
    } catch (error: any) {
      console.error("EXCEPCIÓN ATRAPADA: ", error);
      Alert.alert('Error al publicar', error.message || error.toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <MaterialIcons name="close" size={28} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.title}>New Post</Text>
          <View style={{ width: 48 }} />
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={[styles.imagePlaceholder, image && styles.imagePlaceholderFilled]}
            onPress={handleSelectImage}
            activeOpacity={0.8}
          >
            {image ? (
              <Image source={{ uri: image.uri }} style={styles.selectedImage} />
            ) : (
              <>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="add-a-photo" size={48} color="#9ca3af" />
                </View>
                <Text style={styles.placeholderText}>Tap to select a photo</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="What's on your furry friend's mind?"
              placeholderTextColor="#9ca3af"
              multiline
              value={caption}
              onChangeText={setCaption}
              maxLength={500}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.publishButton, (!image || loading) && styles.publishButtonDisabled]}
            onPress={handlePublish}
            disabled={!image || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.publishText}>Publish</Text>
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
    backgroundColor: '#f8f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  imagePlaceholder: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 24,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  imagePlaceholderFilled: {
    borderWidth: 0,
    backgroundColor: '#000',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  iconContainer: {
    padding: 16,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  inputContainer: {
    flex: 1,
    marginTop: 24,
  },
  captionInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    color: '#1f2937',
    textAlignVertical: 'top',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
  publishButton: {
    backgroundColor: '#f53d3d',
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#f53d3d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});