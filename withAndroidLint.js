const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = (config) => {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;

    // Remove any previously misplaced lint block (outside android {})
    gradle = gradle.replace(/\n[ \t]*lint\s*\{[^}]*disable\s+'ExtraTranslation'[^}]*\}/g, '');

    // Insert lint block inside android {} — right before its closing brace,
    // which immediately follows the androidResources block
    gradle = gradle.replace(
      /([ \t]*androidResources\s*\{[^}]*\}\n)([ \t]*\})/,
      (match, androidResources, closingBrace) => {
        return `${androidResources}    lint {\n        disable 'ExtraTranslation'\n    }\n${closingBrace}`;
      }
    );

    config.modResults.contents = gradle;
    return config;
  });
};
