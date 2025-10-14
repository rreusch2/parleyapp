// BIOMETRIC LOGIN FUNCTIONALITY TEMPORARILY DISABLED
// This service will be re-enabled in a future update

// Type definitions for biometric capabilities
export interface BiometricCapabilities {
  isAvailable: boolean;
  biometricType: string[];
  hasHardware: boolean;
  isEnrolled: boolean;
}

// Placeholder service for future implementation
// All methods return safe default values until biometric functionality is re-implemented
export const biometricService = {
  checkBiometricCapabilities: async (): Promise<BiometricCapabilities> => ({
    isAvailable: false,
    biometricType: [],
    hasHardware: false,
    isEnrolled: false
  }),
  
  authenticateWithBiometrics: async (): Promise<{ success: boolean; error?: string }> => ({
    success: false,
    error: 'Biometric authentication not available'
  }),
  
  isBiometricLoginEnabled: async (): Promise<boolean> => false,
  
  setBiometricLoginEnabled: async (enabled: boolean): Promise<void> => {
    // Placeholder - does nothing
  },
  
  storeCredentialsForBiometric: async (email: string, hashedPassword: string): Promise<void> => {
    // Placeholder - does nothing
  },
  
  getStoredCredentials: async (): Promise<{ email: string; hashedPassword: string } | null> => null,
  
  clearStoredCredentials: async (): Promise<void> => {
    // Placeholder - does nothing
  },
  
  getBiometricDescription: async (): Promise<string> => 'Biometric authentication not available'
}; 