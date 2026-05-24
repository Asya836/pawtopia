const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure Metro resolves common JS module types used by Firebase packages
if (!config.resolver.sourceExts.includes('cjs')) {
    config.resolver.sourceExts.push('cjs');
}
if (!config.resolver.sourceExts.includes('mjs')) {
    config.resolver.sourceExts.push('mjs');
}
// Allow resolving files like `index.rn.js` used by some Firebase packages
if (!config.resolver.sourceExts.includes('rn')) {
    config.resolver.sourceExts.push('rn');
}

if (!config.resolver.assetExts.includes('txt')) {
    config.resolver.assetExts.push('txt');
}

module.exports = config;
