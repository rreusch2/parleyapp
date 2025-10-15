import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';

interface ProfessorLockChatKitProps {
  visible: boolean;
  onClose: () => void;
}

export const ProfessorLockChatKit: React.FC<ProfessorLockChatKitProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const { subscriptionTier } = useSubscription();
  const colorScheme = useColorScheme();
  const webViewRef = useRef<WebView>(null);

  const isEliteUser = subscriptionTier === 'elite';
  const userTheme = colorScheme === 'dark' ? 'dark' : 'light';

  // ChatKit HTML that will be loaded in WebView
  const chatKitHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <script src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js" async></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      height: 100%; 
      width: 100%; 
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    }
    #chat-container { 
      height: 100vh; 
      width: 100vw; 
    }
  </style>
</head>
<body>
  <div id="chat-container"></div>
  
  <script type="module">
    import { ChatKit } from 'https://cdn.skypack.dev/@openai/chatkit-react';
    
    // Fetch ChatKit session token from your backend
    async function getClientSecret() {
      const response = await fetch('${process.env.EXPO_PUBLIC_API_URL}/api/chatkit/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '${user?.id}',
          userTier: '${subscriptionTier}'
        })
      });
      const { client_secret } = await response.json();
      return client_secret;
    }

    // Initialize ChatKit
    const control = await ChatKit.init({
      api: {
        async getClientSecret(existing) {
          if (existing) {
            // Refresh session if needed
            return await getClientSecret();
          }
          return await getClientSecret();
        }
      },
      theme: {
        colorScheme: '${userTheme}',
        color: {
          accent: {
            primary: '${isEliteUser ? '#FFD700' : '#2D8CFF'}',
            level: 2
          }
        },
        radius: 'md',
        density: 'comfortable',
        typography: {
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        }
      },
      composer: {
        placeholder: 'Ask Professor Lock anything about betting...'
      },
      startScreen: {
        greeting: '${isEliteUser ? '🏆 Welcome to Professor Lock Elite Edition!' : '👋 Hey champ! What can I help you with today?'}',
        prompts: [
          { 
            name: 'Build me a parlay', 
            prompt: 'Build me a 3-leg parlay for today', 
            icon: 'write'
          },
          { 
            name: 'Analyze a pick', 
            prompt: 'What do you think about this pick?', 
            icon: 'search'
          },
          { 
            name: 'Today\\'s best bets', 
            prompt: 'What are your best bets for today?', 
            icon: 'star'
          }
        ]
      },
      header: {
        customButtonRight: {
          icon: 'close',
          onClick: () => {
            // Send message to React Native to close modal
            window.ReactNativeWebView?.postMessage(JSON.stringify({ action: 'close' }));
          }
        }
      }
    });

    // Render ChatKit into container
    const container = document.getElementById('chat-container');
    ChatKit.render(container, control);
  </script>
</body>
</html>
  `;

  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.action === 'close') {
        onClose();
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: chatKitHTML }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="always"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent'
  }
});

