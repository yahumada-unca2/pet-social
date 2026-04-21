import { MaterialIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'error' as 'error' | 'success' | 'info' });

  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  async function signInWithGoogle() {
    try {
      setLoading(true);
      const redirectUrl = Linking.createURL('/auth');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          // Forzar que Google pregunte con qué cuenta iniciar sesión
          queryParams: {
            prompt: 'select_account'
          },
          // En web, dejamos que Supabase redirija directamente. En móvil, manejamos la URL con WebBrowser.
          skipBrowserRedirect: Platform.OS !== 'web', 
        },
      });

      if (error) throw error;

      // Código solo para dispositivos móviles (iOS/Android)
      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success') {
          const { url } = result;
          const params = new URLSearchParams(url.split('#')[1]);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
             await supabase.auth.setSession({
                access_token,
                refresh_token
             });
          }
        }
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      showAlert('Sign In Failed', error.message);
    } finally {
      if (Platform.OS !== 'web') setLoading(false);
    }
  }

  async function signInWithEmail() {
    if (!email || !password) {
      return showAlert('Missing fields', 'Please enter both email and password');
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      showAlert('Sign In Failed', error.message);
    } else {
      router.replace('/(tabs)');
    }
    setLoading(false);
  }

  async function signUpWithEmail() {
    if (!email || !password || !confirmPassword) {
      return showAlert('Missing fields', 'Please enter email, password, and confirm your password to create an account');
    }
    
    if (password !== confirmPassword) {
      return showAlert('Error', 'Passwords do not match');
    }

    setLoading(true);
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      showAlert('Sign Up Failed', error.message);
    } else if (!session) {
      showAlert('Success', 'Please check your inbox for email verification!', 'success');
    } else {
      router.replace('/(tabs)');
    }
    setLoading(false);
  }

  async function resetPassword() {
    if (!email) {
      return showAlert('Email required', 'Please enter your email in the input above first to reset your password.');
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      showAlert('Reset Password Failed', error.message);
    } else {
      showAlert('Success', 'Password reset instructions have been sent to your email.', 'success');
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFF8F0" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Pet Social</Text>
          </View>

          {/* Hero Illustration */}
          <View style={styles.heroContainer}>
            <View style={styles.imageWrapper}>
               <Image 
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOPJ9_sAwL5402yruujbPnHs519rfyzj89-FZseKDH9yYUqZsxptQB9u-tT2-89RZlVLeXSiFl-7rLAnG4TEzMKXjKh9NvMZGjlJUdU1qr2rBiK7UWvtfpl43u93S9VW2acPgO5p6tHHKiXkvD7IF9uRDcCVVxNzoJQ8vSgSC4Bg6m_OkkNVPF3c-m_8Hl1GPG_ChtvZqADriRTtH17J0LGcrfoH14BlXaO8MHMSJxAXrUXr47YDcABZFYRvje_jYiSj1ZrlLfNac' }}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>
            <MaterialIcons name="stars" size={36} color="#FDCB6E" style={styles.starIcon} />
            <MaterialIcons name="favorite" size={30} color="#FF6B6B" style={styles.heartIcon} />
          </View>

          {/* Auth Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="mail" size={24} color="#A8A8B3" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#A8A8B3"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputWrapper}>
              <MaterialIcons name="lock" size={24} color="#A8A8B3" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#A8A8B3"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {!isLogin && (
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock-outline" size={24} color="#A8A8B3" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor="#A8A8B3"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            )}

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={isLogin ? signInWithEmail : signUpWithEmail}
              disabled={loading}
            >
              <View style={styles.primaryButtonInner}>
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.socialButton} disabled={loading} onPress={signInWithGoogle}>
              <View style={styles.socialButtonInner}>
                <MaterialIcons name="pets" size={24} color="#FDCB6E" />
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Bottom Links */}
          <View style={styles.bottomLinks}>
            {isLogin ? (
              <>
                {/* 
                <TouchableOpacity onPress={resetPassword} disabled={loading}>
                  <Text style={styles.forgotPassword}>Forgot password?</Text>
                </TouchableOpacity>
                */}
                <View style={styles.toggleAuthContainer}>
                  <Text style={styles.toggleAuthText}>New to the pack? </Text>
                  <TouchableOpacity onPress={() => setIsLogin(false)} disabled={loading}>
                    <Text style={styles.toggleAuthAction}>Create account</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.toggleAuthContainer}>
                <Text style={styles.toggleAuthText}>Already in the pack? </Text>
                <TouchableOpacity onPress={() => setIsLogin(true)}>
                  <Text style={styles.toggleAuthAction}>Log in instead</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={alertVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAlertVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setAlertVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              
              <View style={{ width: '100%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 }}>
                {alertConfig.type === 'error' ? (
                  <MaterialIcons name="error-outline" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
                ) : alertConfig.type === 'success' ? (
                  <MaterialIcons name="check-circle-outline" size={48} color="#10B981" style={{ marginBottom: 12 }} />
                ) : (
                  <MaterialIcons name="info-outline" size={48} color="#3B82F6" style={{ marginBottom: 12 }} />
                )}
                
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2D3436', marginBottom: 8, textAlign: 'center' }}>
                  {alertConfig.title}
                </Text>
                <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
                  {alertConfig.message}
                </Text>
                
                <TouchableOpacity 
                  style={[styles.modalOption, { 
                    justifyContent: 'center', 
                    backgroundColor: alertConfig.type === 'error' ? '#EF4444' : alertConfig.type === 'success' ? '#10B981' : '#3B82F6', 
                    borderRadius: 12, 
                    marginBottom: 8, 
                    width: '100%', 
                    borderBottomWidth: 0 
                  }]}
                  onPress={() => setAlertVisible(false)}
                >
                  <Text style={[styles.modalOptionText, { color: '#FFF', fontWeight: 'bold' }]}>Aceptar</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#FFF8F0', // cream
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    marginBottom: 32,
    marginTop: 16,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FF6B6B', // coral
    transform: [{ rotate: '-3deg' }],
  },
  heroContainer: {
    width: 240,
    height: 240,
    marginBottom: 40,
    position: 'relative',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  starIcon: {
    position: 'absolute',
    top: -8,
    right: -16,
    transform: [{ rotate: '12deg' }],
  },
  heartIcon: {
    position: 'absolute',
    bottom: 16,
    left: -24,
    transform: [{ rotate: '-12deg' }],
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  inputWrapper: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#D9534F', // shadow border color
    borderRadius: 28,
    marginTop: 8,
  },
  primaryButtonInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FF6B6B', // coral
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateY: -4 }], // tactile effect
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(168, 168, 179, 0.3)', // muted/30
  },
  dividerText: {
    color: '#A8A8B3',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  socialButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#E5B863', // shadow border color for google button
    borderRadius: 28,
  },
  socialButtonInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FDCB6E',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    transform: [{ translateY: -4 }], // tactile effect
  },
  socialButtonText: {
    color: '#2D3436',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomLinks: {
    marginTop: 32,
    alignItems: 'center',
    gap: 16,
  },
  forgotPassword: {
    color: '#f53d3d',
    fontSize: 15,
    fontWeight: 'bold',
  },
  toggleAuthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleAuthText: {
    color: '#2D3436',
    fontSize: 15,
    fontWeight: '600',
  },
  toggleAuthAction: {
    color: '#f53d3d',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 34,
    alignItems: 'center',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3436',
    marginLeft: 12,
  }
});
