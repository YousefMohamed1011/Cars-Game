const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const assetExts = ['glb', 'gltf', 'bin', 'obj', 'mtl', 'mp3', 'wav', 'png', 'jpg', 'jpeg', 'hdr'];
assetExts.forEach(ext => {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
});

module.exports = config;
