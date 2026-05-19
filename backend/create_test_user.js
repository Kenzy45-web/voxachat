const { pool } = require('./database');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function create() {
    try {
        const username = 'testpilot';
        const email = 'testpilot@voxa.com';
        const password = 'password123';
        const best_game = 'cod-mobile.png';
        const avatar_url = 'https://api.dicebear.com/7.x/bottts/svg?seed=TestPilot';

        // Check if user exists
        await pool.query('DELETE FROM users WHERE email = $1 OR username = $2', [email, username]);

        const password_hash = await bcrypt.hash(password, 10);
        
        await pool.query(
            `INSERT INTO users (username, email, password_hash, is_verified, best_game, avatar_url) 
             VALUES ($1, $2, $3, TRUE, $4, $5)`,
            [username, email, password_hash, best_game, avatar_url]
        );

        console.log('TEST USER testpilot@voxa.com / password123 CREATED.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
create();
