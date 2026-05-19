const { pool } = require('./database');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function check() {
    try {
        const users = await pool.query('SELECT id, username, email, is_verified, best_game, avatar_url FROM users');
        console.log('USERS:', users.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
