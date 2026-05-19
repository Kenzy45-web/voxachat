const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { pool } = require('./database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Ensure the database has the avatar_url column
pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;')
    .then(() => console.log('Database schema verified (avatar_url).'))
    .catch(err => console.error('Error verifying database schema:', err));

// Add is_active column for deactivation feature
pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;')
    .then(() => console.log('Database schema verified (is_active).'))
    .catch(err => console.error('Error verifying database schema:', err));

// Add best_game column
pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS best_game TEXT;')
    .then(() => console.log('Database schema verified (best_game).'))
    .catch(err => console.error('Error verifying database schema:', err));

// Add social_links column
pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links TEXT;')
    .then(() => console.log('Database schema verified (social_links).'))
    .catch(err => console.error('Error verifying database schema:', err));

// Ensure the waitlist table exists
pool.query('CREATE TABLE IF NOT EXISTS waitlist (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);')
    .then(() => {
        console.log('Database schema verified (waitlist).');
        // Add username column to waitlist table if not exists
        return pool.query('ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS username VARCHAR(255);');
    })
    .then(() => console.log('Database schema verified (waitlist username).'))
    .catch(err => console.error('Error verifying waitlist schema:', err));

// Ensure the lobby_messages table exists
pool.query(`
    CREATE TABLE IF NOT EXISTS lobby_messages (
        id SERIAL PRIMARY KEY,
        game_name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`)
    .then(() => console.log('Database schema verified (lobby_messages).'))
    .catch(err => console.error('Error verifying lobby_messages schema:', err));

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        // Clear out any unverified user with this email or username
        const unverifiedCheck = await pool.query('SELECT * FROM users WHERE (email = $1 OR username = $2) AND is_verified = FALSE', [email, username]);
        if (unverifiedCheck.rows.length > 0) {
            for (const row of unverifiedCheck.rows) {
                await pool.query('DELETE FROM otps WHERE email = $1', [row.email]);
                await pool.query('DELETE FROM users WHERE id = $1', [row.id]);
            }
        }

        // Check if verified email exists
        const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1 AND is_verified = TRUE', [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Check if verified username exists
        const usernameCheck = await pool.query('SELECT * FROM users WHERE username = $1 AND is_verified = TRUE', [username]);
        if (usernameCheck.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Username already taken' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)',
            [username, email, password_hash]
        );

        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60000); // 10 mins
        await pool.query(
            'INSERT INTO otps (email, otp, expires_at) VALUES ($1, $2, $3)',
            [email, otp, expiresAt]
        );

        // Send Email
        await transporter.sendMail({
            from: `"Voxa Server" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Voxa Server - Verification Code',
            html: `
            <div style="font-family: 'Inter', Arial, sans-serif; padding: 40px 20px; background-color: #0b0d17; color: #ffffff; text-align: center; border-radius: 12px; border: 1px solid rgba(0, 229, 255, 0.2); max-width: 500px; margin: 0 auto;">
                <h1 style="color: #ffffff; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px;">
                    <span style="color: #00e5ff;">Voxa</span> Server
                </h1>
                <p style="color: #a0a5b5; font-size: 14px; margin-top: 0;">Global Gaming Network Protocol</p>
                
                <div style="margin: 40px 0; padding: 20px; background-color: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 12px;">
                    <p style="margin: 0; color: #a0a5b5; font-size: 14px; text-transform: uppercase;">Operator Clearance Code</p>
                    <h2 style="color: #00e5ff; font-size: 36px; letter-spacing: 5px; margin: 10px 0;">${otp}</h2>
                </div>
                
                <p style="color: #a0a5b5; font-size: 12px;">This code will expire in 10 minutes.<br>If you did not request this, please ignore this transmission.</p>
            </div>`
        });

        res.json({ success: true, message: 'Operator clearance requested. Check your email for OTP.' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/auth/verify', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const result = await pool.query('SELECT * FROM otps WHERE email = $1 AND otp = $2 AND expires_at > NOW()', [email, otp]);
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
        }
        await pool.query('UPDATE users SET is_verified = TRUE WHERE email = $1', [email]);
        await pool.query('DELETE FROM otps WHERE email = $1', [email]);
        
        res.json({ success: true, message: 'Verification successful.' });
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/auth/onboarding', async (req, res) => {
    const { email, avatarUrl } = req.body;
    try {
        await pool.query('UPDATE users SET avatar_url = $1 WHERE email = $2', [avatarUrl, email]);
        
        // Fetch user info for the email
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userRes.rows[0];
        const rank = user.id;

        // Send Welcome Email
        await transporter.sendMail({
            from: `"Voxa Server" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Voxa Connection Established: #${rank}`,
            html: `
            <div style="font-family: 'Inter', Arial, sans-serif; padding: 40px 20px; background-color: #0b0d17; color: #ffffff; text-align: center; border-radius: 12px; border: 1px solid rgba(0, 229, 255, 0.2); max-width: 500px; margin: 0 auto;">
                <div style="margin-bottom: 25px;">
                    <span style="font-size: 24px; font-weight: 800; color: #00e5ff; letter-spacing: 2px;">VOXA SERVER</span>
                </div>
                
                <div style="margin: 20px auto; width: 100px; height: 100px; border-radius: 20px; border: 2px solid #00e5ff; overflow: hidden; background: #1a1c29;">
                    <img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">
                </div>

                <h1 style="color: #ffffff; margin-bottom: 5px;">WELCOME, <span style="color: #00e5ff;">${user.username.toUpperCase()}</span></h1>
                <p style="color: #a0a5b5; font-size: 14px; margin-top: 0;">Global Identity Confirmed</p>
                
                <div style="margin: 30px 0; padding: 25px; background-color: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 20px;">
                    <div style="font-size: 12px; color: #a0a5b5; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Server Clearance Rank</div>
                    <div style="font-size: 40px; font-weight: 800; color: #00e5ff;">#${rank}</div>
                </div>
                
                <p style="color: #a0a5b5; font-size: 13px; line-height: 1.5;">
                    Operator profile established. Access to global clusters is now active. <br>
                    Welcome to the network, Operator.
                </p>
            </div>`
        });

        res.json({ 
            success: true, 
            message: 'Onboarding complete.',
            user: {
                username: user.username,
                email: user.email,
                avatar: avatarUrl,
                rank: rank
            }
        });
    } catch (error) {
        console.error('Onboarding Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid credentials' });
        }
        
        const user = userResult.rows[0];
        if (!user.is_verified) {
            return res.status(403).json({ success: false, error: 'Account not verified' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: 'Invalid credentials' });
        }

        let reactivated = false;
        if (user.is_active === false) {
            await pool.query('UPDATE users SET is_active = TRUE WHERE email = $1', [email]);
            reactivated = true;
            try {
                await transporter.sendMail({
                    from: `"Voxa Server" <${process.env.SMTP_USER}>`,
                    to: email,
                    subject: 'Voxa Protocol: Network ID Reactivated',
                    html: `
                    <div style="font-family: 'Inter', Arial, sans-serif; padding: 40px 20px; background-color: #0b0d17; color: #ffffff; text-align: center; border-radius: 12px; border: 1px solid rgba(0, 229, 255, 0.2); max-width: 500px; margin: 0 auto;">
                        <h1 style="color: #00e5ff; letter-spacing: 2px; text-transform: uppercase;">WELCOME BACK</h1>
                        <p style="color: #a0a5b5; font-size: 14px;">Your Network ID has been fully restored.</p>
                        <div style="margin: 30px 0; padding: 25px; background-color: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 15px;">
                            <h2 style="margin: 0; color: #00e5ff; font-size: 24px;">${user.username}</h2>
                            <p style="margin: 5px 0 0 0; color: #fff;">Rank: #${user.id}</p>
                        </div>
                    </div>`
                });
            } catch (err) {
                console.error('Failed to send welcome back email:', err);
            }
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ 
            success: true, 
            token, 
            username: user.username,
            email: user.email,
            avatar: user.avatar_url,
            rank: user.id,
            bestGame: user.best_game,
            socialLinks: user.social_links ? JSON.parse(user.social_links) : {},
            reactivated
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/auth/deactivate', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userRes = await pool.query('UPDATE users SET is_active = FALSE WHERE email = $1 RETURNING *', [decoded.email]);
        if (userRes.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
        
        const user = userRes.rows[0];
        
        await transporter.sendMail({
            from: `"Voxa Server" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: 'Voxa Protocol: Network ID Deactivated',
            html: `
            <div style="font-family: 'Inter', Arial, sans-serif; padding: 40px 20px; background-color: #0b0d17; color: #ffffff; text-align: center; border-radius: 12px; border: 1px solid rgba(255, 51, 102, 0.2); max-width: 500px; margin: 0 auto;">
                <div style="margin-bottom: 20px;">
                    <span style="font-size: 24px; font-weight: 800; color: #ff3366; letter-spacing: 2px;">VOXA SERVER</span>
                </div>
                <h2 style="color: #ffffff; margin-bottom: 5px; text-transform: uppercase;">ID DEACTIVATED</h2>
                
                <p style="color: #a0a5b5; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                    Your account has been deactivated. Your data and messages remain secure. <br>
                    To restore access to the network at any time, simply log back into the Voxa Server standard login page.
                </p>
            </div>`
        });

        res.json({ success: true, message: 'Account deactivated' });
    } catch (error) {
        console.error('Deactivate Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/auth/activate', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid credentials' });
        }
        
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: 'Invalid credentials' });
        }

        await pool.query('UPDATE users SET is_active = TRUE WHERE email = $1', [email]);

        await transporter.sendMail({
            from: `"Voxa Server" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Voxa Protocol: Network ID Reactivated',
            html: `
            <div style="font-family: 'Inter', Arial, sans-serif; padding: 40px 20px; background-color: #0b0d17; color: #ffffff; text-align: center; border-radius: 12px; border: 1px solid rgba(0, 229, 255, 0.2); max-width: 500px; margin: 0 auto;">
                <h1 style="color: #00e5ff; letter-spacing: 2px; text-transform: uppercase;">WELCOME BACK</h1>
                <p style="color: #a0a5b5; font-size: 14px;">Your Network ID has been fully restored.</p>
                <div style="margin: 30px 0; padding: 25px; background-color: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 15px;">
                    <h2 style="margin: 0; color: #00e5ff; font-size: 24px;">${user.username}</h2>
                    <p style="margin: 5px 0 0 0; color: #fff;">Rank: #${user.id}</p>
                </div>
            </div>`
        });

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, message: 'Account reactivated', token, username: user.username, rank: user.id });
    } catch (error) {
        console.error('Activate Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/api/profile', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [decoded.email]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
        
        const user = result.rows[0];
        res.json({
            success: true,
            user: {
                username: user.username,
                email: user.email,
                avatar: user.avatar_url,
                rank: user.id,
                bestGame: user.best_game,
                socialLinks: user.social_links ? JSON.parse(user.social_links) : {}
            }
        });
    } catch (error) {
        console.error('Fetch Profile Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
});

app.post('/api/profile/update', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { avatar, bestGame, socialLinks } = req.body;
        
        const socialLinksStr = socialLinks ? JSON.stringify(socialLinks) : null;
        
        await pool.query(
            'UPDATE users SET avatar_url = $1, best_game = $2, social_links = $3 WHERE email = $4',
            [avatar, bestGame, socialLinksStr, decoded.email]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Profile Update Error:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile in database' });
    }
});

app.post('/api/auth/google', async (req, res) => {
    const { email, google_id } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            // If they signed up normally but now use Google, update their google_id
            if (!user.google_id) {
                await pool.query('UPDATE users SET google_id = $1, is_verified = TRUE WHERE email = $2', [google_id, email]);
            }
            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
            return res.json({ success: true, token, username: user.username, requiresRegistration: false });
        } else {
            // New user, needs username and password
            return res.json({ success: true, requiresRegistration: true, email, google_id });
        }
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Network ID not found' });
        }

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 15 * 60000); // 15 mins
        await pool.query(
            'INSERT INTO otps (email, otp, expires_at) VALUES ($1, $2, $3)',
            [email, otp, expiresAt]
        );

        // Send Password Reset Email
        await transporter.sendMail({
            from: `"Voxa Server" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Voxa Protocol: Password Recovery',
            html: `
            <div style="font-family: 'Inter', Arial, sans-serif; padding: 40px 20px; background-color: #0b0d17; color: #ffffff; text-align: center; border-radius: 12px; border: 1px solid rgba(0, 229, 255, 0.2); max-width: 500px; margin: 0 auto;">
                <div style="margin-bottom: 20px;">
                    <span style="font-size: 24px; font-weight: 800; color: #00e5ff; letter-spacing: 2px;">VOXA SERVER</span>
                </div>
                <h2 style="color: #ffffff; margin-bottom: 5px;">PASSWORD RECOVERY</h2>
                <p style="color: #a0a5b5; font-size: 14px; margin-top: 0;">Identity Verification Protocol</p>
                
                <div style="margin: 40px 0; padding: 30px; background-color: rgba(255, 51, 102, 0.05); border: 1px solid rgba(255, 51, 102, 0.2); border-radius: 20px;">
                    <p style="margin: 0 0 10px 0; color: #a0a5b5; font-size: 12px; text-transform: uppercase;">Recovery Clearance Code</p>
                    <h2 style="color: #ff3366; font-size: 40px; letter-spacing: 8px; margin: 0;">${otp}</h2>
                </div>
                
                <p style="color: #a0a5b5; font-size: 13px; line-height: 1.5;">
                    Use this code to establish a new access protocol. <br>
                    If you did not initiate this recovery, secure your account immediately.
                </p>
            </div>`
        });

        res.json({ success: true, message: 'Recovery code sent to your Network ID.' });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/auth/google-complete', async (req, res) => {
    const { username, email, password, google_id } = req.body;
    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Username already taken' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash, google_id, is_verified) VALUES ($1, $2, $3, $4, TRUE) RETURNING id, username',
            [username, email, password_hash, google_id]
        );
        
        const user = result.rows[0];
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, username: user.username });
    } catch (error) {
        console.error('Google Complete Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/waitlist', async (req, res) => {
    const { email, username } = req.body;
    try {
        // Check if email already exists
        const check = await pool.query('SELECT * FROM waitlist WHERE email = $1', [email]);
        if (check.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'You are already in the family! We will notify you when we launch.' });
        }

        // Insert new user and get their rank (ID)
        const result = await pool.query(
            'INSERT INTO waitlist (email, username) VALUES ($1, $2) RETURNING id', 
            [email, username || 'Anonymous Operator']
        );
        const rank = result.rows[0].id;

        res.json({ 
            success: true, 
            message: 'Waitlist joined successfully.',
            user: {
                username: username || 'Anonymous Operator',
                email: email,
                rank: rank
            }
        });

        // Send Waitlist Confirmation Email (Async/Optional)
        try {
            await transporter.sendMail({
                from: `"Voxa Server" <${process.env.SMTP_USER}>`,
                to: email,
                subject: `Voxa Access Granted: #${rank}`,
                html: `
                <div style="font-family: 'Inter', Arial, sans-serif; padding: 40px 20px; background-color: #0b0d17; color: #ffffff; text-align: center; border-radius: 12px; border: 1px solid rgba(0, 229, 255, 0.2); max-width: 500px; margin: 0 auto;">
                    <div style="margin-bottom: 20px;">
                        <span style="font-size: 24px; font-weight: 800; color: #00e5ff; letter-spacing: 2px;">VOXA SERVER</span>
                    </div>
                    
                    <h1 style="color: #ffffff; margin-bottom: 5px;">WELCOME, <span style="color: #00e5ff;">${username || 'OPERATOR'}</span></h1>
                    <p style="color: #a0a5b5; font-size: 14px; margin-top: 0;">Global Access Protocol Initialized</p>
                    
                    <div style="margin: 40px 0; padding: 30px; background-color: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 20px;">
                        <div style="font-size: 12px; color: #a0a5b5; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Global Server Rank</div>
                        <div style="font-size: 48px; font-weight: 800; color: #00e5ff; text-shadow: 0 0 20px rgba(0, 229, 255, 0.5);">#${rank}</div>
                    </div>
                    
                    <p style="margin: 20px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                        Your spot has been prioritized for the <strong>August 10, 2026</strong> launch. 
                        We have dispatched your clearance protocols to the global network.
                    </p>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <p style="color: #a0a5b5; font-size: 12px;">This is an automated system dispatch. Do not reply.</p>
                    </div>
                </div>`
            });
            console.log('Confirmation email sent to:', email);
        } catch (emailError) {
            console.error('Email sending failed (but user registered):', emailError);
        }
    } catch (error) {
        console.error('Waitlist Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Active Users Lobby Memory Tracker
const activeLobbyUsers = {};

app.post('/api/lobby/heartbeat', (req, res) => {
    const { gameName, username } = req.body;
    if (!gameName || !username) {
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const now = Date.now();
    if (!activeLobbyUsers[gameName]) {
        activeLobbyUsers[gameName] = {};
    }
    // Update the timestamp for the user in this game lobby
    activeLobbyUsers[gameName][username] = now;

    // Prune inactive users (older than 1.5 seconds for quick detection)
    const threshold = now - 1500;
    const lobby = activeLobbyUsers[gameName];
    for (const user in lobby) {
        if (lobby[user] < threshold) {
            delete lobby[user];
        }
    }

    // Get count of active users
    const activeCount = Object.keys(activeLobbyUsers[gameName]).length;

    res.json({ success: true, activeCount, activeUsers: Object.keys(activeLobbyUsers[gameName]) });
});

app.post('/api/lobby/leave', (req, res) => {
    const { gameName, username } = req.body;
    if (!gameName || !username) {
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    if (activeLobbyUsers[gameName] && activeLobbyUsers[gameName][username]) {
        delete activeLobbyUsers[gameName][username];
    }

    const activeCount = activeLobbyUsers[gameName] ? Object.keys(activeLobbyUsers[gameName]).length : 0;
    res.json({ success: true, activeCount });
});

// Send message to game lobby
app.post('/api/lobby/messages', async (req, res) => {
    const { gameName, username, message } = req.body;
    if (!gameName || !username || !message) {
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }
    try {
        await pool.query(
            'INSERT INTO lobby_messages (game_name, username, message) VALUES ($1, $2, $3)',
            [gameName, username, message]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending lobby message:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Fetch messages for a specific game lobby
app.get('/api/lobby/messages', async (req, res) => {
    const { gameName } = req.query;
    if (!gameName) {
        return res.status(400).json({ success: false, error: 'Missing gameName parameter' });
    }
    try {
        const result = await pool.query(
            `SELECT lm.id, lm.game_name, lm.username, lm.message, lm.created_at, u.avatar_url, u.id AS rank 
             FROM lobby_messages lm
             LEFT JOIN users u ON lm.username = u.username
             WHERE lm.game_name = $1
             ORDER BY lm.created_at ASC
             LIMIT 100`,
            [gameName]
        );
        res.json({ success: true, messages: result.rows });
    } catch (error) {
        console.error('Error fetching lobby messages:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin Route to get waitlist
app.get('/api/admin/waitlist', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM waitlist ORDER BY created_at DESC');
        res.json({ success: true, count: result.rows.length, users: result.rows });
    } catch (error) {
        console.error('Admin Fetch Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch waitlist' });
    }
});

const PORT = process.env.PORT || 3050;
app.listen(PORT, () => {
    console.log(`Voxa Server Network initialized on port ${PORT}`);
});
