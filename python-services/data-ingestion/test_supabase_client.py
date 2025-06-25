from supabase import create_client, Client
import os

def test_supabase_client():
    # Use same credentials as working backend
    url = "https://iriaegoipkjtktitpary.supabase.co"
    key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0"
    
    try:
        supabase: Client = create_client(url, key)
        
        # Test connection by getting count of player_game_stats
        response = supabase.table('player_game_stats').select('*', count='exact').limit(1).execute()
        
        print(f"✅ Supabase client connection successful!")
        print(f"📊 player_game_stats count: {response.count}")
        print(f"🎯 This matches your working backend connection method")
        
        return True
        
    except Exception as e:
        print(f"❌ Supabase client connection failed: {e}")
        return False

if __name__ == "__main__":
    test_supabase_client() 