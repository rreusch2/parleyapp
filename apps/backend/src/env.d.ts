declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    
    // Supabase
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    
    // AI keys
    DEEPSEEK_API_KEY?: string;
    XAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    
    // Sports Data APIs
    THEODDS_API_KEY?: string;
    SPORTRADAR_API_KEY?: string;
    
    // Other
    PYTHON_ML_SERVER_URL?: string;
  }
}

export {};

