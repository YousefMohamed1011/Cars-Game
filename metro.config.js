const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const assetExts = ['glb', 'gltf', 'obj', 'wav', 'mp3', 'png', 'jpg', 'jpeg', 'hdr'];
assetExts.forEach(ext => {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
});

module.exports = config;
