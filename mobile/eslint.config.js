// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // Supabase verisi ekran açılışında effect içinden yükleniyor (async fetch → setState).
      // React Compiler kuralı bunu async/await sonrası da olsa hata sayıyor; bilinçli desen olduğu için uyarı.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
