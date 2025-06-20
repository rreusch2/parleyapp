import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
// import { Link } from 'expo-router'; // No longer needed for these buttons
import { useRouter } from 'expo-router'; // Import useRouter
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, UserPlus, CheckCircle, Bug } from 'lucide-react-native';

export default function LandingPage() {
  const router = useRouter(); // Initialize router

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
          <TouchableOpacity 
            style={[styles.button, styles.loginButton]} 
            onPress={() => router.push('/login')} // Programmatic navigation
          >
            <LogIn color="black" size={20} style={styles.iconStyle} />
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.signupButton]}
            onPress={() => router.push('/signup')} // Programmatic navigation
          >
            <UserPlus color="black" size={20} style={styles.iconStyle} />
            <Text style={styles.signupButtonText}>Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.debugButton]}
            onPress={() => router.push('/debug-react-native-supabase')} // Debug navigation
          >
            <Bug color="white" size={20} style={styles.iconStyle} />
            <Text style={styles.debugButtonText}>Debug RN Supabase</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Features</Text>
          <View style={styles.featureItem}>
            <CheckCircle color="#ffffff" size={18} style={styles.featureIcon} />
            <Text style={styles.featureText}>AI-Powered Predictions</Text>
          </View>
          <View style={styles.featureItem}>
            <CheckCircle color="#ffffff" size={18} style={styles.featureIcon} />
            <Text style={styles.featureText}>Personalized Betting Strategy</Text>
          </View>
          <View style={styles.featureItem}>
            <CheckCircle color="#ffffff" size={18} style={styles.featureIcon} />
            <Text style={styles.featureText}>Real-time Updates</Text>
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
    justifyContent: 'space-around',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 80,
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
    textAlign: 'center',
  },
  buttonContainer: {
    marginVertical: 30,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginVertical: 10,
    width: '85%',
  },
  loginButton: {
    backgroundColor: '#4169e1',
    borderRadius: 30,
    // borderWidth: 2, // Removed diagnostic
    // borderColor: 'blue', // Removed diagnostic
    // opacity: 1, // Removed diagnostic
  },
  signupButton: {
    borderRadius: 30,
    backgroundColor: '#ffffff',
    // borderWidth: 2, // Removed diagnostic
    // borderColor: 'green', // Removed diagnostic
    // opacity: 1, // Removed diagnostic
  },
  loginButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  debugButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'white',
  },
  debugButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconStyle: {
    marginRight: 10,
  },
  featuresContainer: {
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  featuresTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  featureIcon: {
    marginRight: 10,
  },
  featureText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
});