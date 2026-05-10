require('dotenv').config();
const { pool } = require('./database');

async function resetDatabase() {
    try {
        console.log("Connecting to the database to clear old VoxaChat data...");
        // Drop old tables if they exist
        await pool.query('DROP TABLE IF EXISTS users CASCADE;');
        await pool.query('DROP TABLE IF EXISTS otps CASCADE;');
        await pool.query('DROP TABLE IF EXISTS sessions CASCADE;');
        
        console.log("Old tables dropped. Initializing new schema for Voxa Server...");
        
        // Recreate the core users table for the new app
        await pool.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                google_id VARCHAR(255) UNIQUE,
                is_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            );
        `);

        // Recreate OTP table
        await pool.query(`
            CREATE TABLE otps (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                otp VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log("New database schema created successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error resetting the database:", error);
        process.exit(1);
    }
}

resetDatabase();
