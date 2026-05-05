module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // @react-navigation/stack에 필요
    ],
    env: {
      production: {
        plugins: ['transform-remove-console'],
      },
    },
  };
};
