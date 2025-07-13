module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'babel-plugin-module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            '@/components': './components',
            '@/app': './app',
            '@/config': './app/config',
            '@/services': './app/services',
            '@/utils': './utils',
            '@/assets': './assets',
            '@/types': './types',
            '@/hooks': './hooks',
            '@/backend': './backend',
          },
        },
      ],
    ],
  };
};
