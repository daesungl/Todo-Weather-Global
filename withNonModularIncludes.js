const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        // Podfile에 use_modular_headers! 가 없으면 target 선언 직전에 삽입합니다.
        if (!podfileContent.includes('use_modular_headers!')) {
          podfileContent = podfileContent.replace(
            /(target\s+['"][^'"]+['"]\s+do)/,
            `use_modular_headers!\n\n$1`
          );
          fs.writeFileSync(podfilePath, podfileContent);
        }
      }
      return config;
    },
  ]);
};
