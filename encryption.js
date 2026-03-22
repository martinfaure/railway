const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : null;
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
    if (!text) return text;
    if (!ENCRYPTION_KEY) {
        console.warn('ENCRYPTION_KEY not set, returning text as-is (DEBUG ONLY)');
        return text;
    }
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(String(text));
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        // Store as IV:EncryptedData (hex)
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error('Encryption Failed:', e);
        return text; // Fallback? Or throw? For legal reasons, maybe throw.
    }
}

function decrypt(text) {
    if (!text) return text;
    if (!ENCRYPTION_KEY) return text;

    try {
        const textParts = text.split(':');
        if (textParts.length < 2) return text; // Not encrypted or legacy
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        // console.error('Decryption error:', e.message); 
        // Maybe it's not encrypted?
        return text;
    }
}

function hash(text) {
    if (!text) return text;
    return crypto.createHash('sha256').update(String(text)).digest('hex');
}

module.exports = { encrypt, decrypt, hash };
