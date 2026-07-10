module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // tamagui's moti/reanimated animation driver
      'react-native-worklets/plugin',
    ],
  };
};
