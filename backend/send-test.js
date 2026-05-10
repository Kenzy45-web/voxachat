require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const mailOptions = {
    from: `"Voxa Test" <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER, // Send to self
    subject: 'SMTP Test Email',
    text: 'This is a test email from your Voxa Server configuration.',
};

transporter.sendMail(mailOptions, function(error, info){
    if (error) {
        console.log("Send Error:", error);
    } else {
        console.log("Email sent: " + info.response);
    }
});
