require('dotenv').config({ path: require('path').join(__dirname, '.env') });
// Same module as runtime API — single pool + schema bootstrap.
const db = require('./db');

(async () => {
    console.log('Starting explicit DB setup...');
    try {
        await db.init();
        console.log('✅ Tables created/verified successfully.');
        process.exit(0);
    } catch (e) {
        console.error('❌ DB Setup Failed:', e);
        process.exit(1);
    }
})();
