import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function LandingPage() {
  return (
    <LinearGradient
      colors={['#1a2a6c', '#b21f1f']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>PARLEY AI</Text>
          <Text style={styles.tagline}>Smart Betting, Powered by AI</Text>
        </View>

        <View style={styles.buttonContainer}>
          <Link href="/login" asChild>
            <TouchableOpacity style={[styles.button, styles.loginButton]}>
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/signup" asChild>
            <TouchableOpacity style={[styles.button, styles.signupButton]}>
              <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Features</Text>
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• AI-Powered Predictions</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• Personalized Betting Strategy</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• Real-time Updates</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 18,
    color: '#ffffff',
    opacity: 0.9,
  },
  buttonContainer: {
    marginVertical: 40,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#ffffff',
  },
  signupButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a2a6c',
  },
  featuresContainer: {
    marginBottom: 40,
  },
  featuresTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  featureItem: {
    marginVertical: 8,
  },
  featureText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
});