const { expo } = require('./app.json');

const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

const androidConfig = googleMapsApiKey
    ? {
        ...expo.android,
        config: {
            ...(expo.android?.config || {}),
            googleMaps: {
                apiKey: googleMapsApiKey,
            },
        },
    }
    : expo.android;

module.exports = {
    ...expo,
    android: androidConfig,
    plugins: [
        ...(expo.plugins || []),
        '@react-native-community/datetimepicker',
    ],
};
