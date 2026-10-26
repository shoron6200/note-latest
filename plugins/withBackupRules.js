/**
 * Android Auto Backup rules for Pocketleaf (config plugin, applied at prebuild).
 *
 * - Google cloud backup (25 MB cap): settings, the notes database and the
 *   daily snapshots. Photos and videos are left out (they would blow the cap,
 *   and the Telegram backup carries them).
 * - Phone-to-phone transfer (no cap): everything.
 * - Never: the Telegram token in SecureStore. Restoring it on another phone
 *   would fail to decrypt anyway, and it should not leave this phone.
 */
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const NAME_FULL = 'pocketleaf_backup_rules';
const NAME_EXTRACT = 'pocketleaf_data_extraction_rules';

const cloud = `
    <include domain="sharedpref" path="."/>
    <exclude domain="sharedpref" path="SecureStore"/>
    <include domain="file" path="SQLite/"/>
    <include domain="file" path="snapshots/"/>`;

const transfer = `
    <include domain="sharedpref" path="."/>
    <exclude domain="sharedpref" path="SecureStore"/>
    <include domain="file" path="."/>`;

const FULL = `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 11 and lower. Written by plugins/withBackupRules.js -->
<full-backup-content>${cloud}
</full-backup-content>
`;

const EXTRACT = `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 12 and higher. Written by plugins/withBackupRules.js -->
<data-extraction-rules>
  <cloud-backup>${cloud.replace(/\n {4}/g, '\n      ')}
  </cloud-backup>
  <device-transfer>${transfer.replace(/\n {4}/g, '\n      ')}
  </device-transfer>
</data-extraction-rules>
`;

module.exports = function withBackupRules(config) {
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${NAME_FULL}.xml`), FULL);
      fs.writeFileSync(path.join(dir, `${NAME_EXTRACT}.xml`), EXTRACT);
      return c;
    },
  ]);
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    app.$['android:fullBackupContent'] = `@xml/${NAME_FULL}`;
    app.$['android:dataExtractionRules'] = `@xml/${NAME_EXTRACT}`;
    return c;
  });
};
