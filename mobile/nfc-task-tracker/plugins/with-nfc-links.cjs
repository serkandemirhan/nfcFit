const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');
module.exports = function withNfcLinks(config) {
  return withAndroidManifest(config, mod => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const filters = activity['intent-filter'] ?? [];
    const action = 'android.nfc.action.NDEF_DISCOVERED';
    if (!filters.some(filter => filter.action?.some(item => item.$['android:name'] === action))) {
      filters.push({
        action: [{ $: { 'android:name': action } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:scheme': 'https', 'android:host': 'nfc-fit.vercel.app', 'android:pathPrefix': '/tag/' } }],
      });
    }
    activity['intent-filter'] = filters;
    return mod;
  });
};
