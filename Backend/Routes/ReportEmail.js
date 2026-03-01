const express = require('express');
const nodemailer = require('nodemailer');

const reportRouter = express.Router();

// Create transporter using environment variables
const createTransporter = () => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS?.replace(/\s/g, ''); // Remove any spaces from app password

    // console.log('[Email] Configuring transporter for:', emailUser);
    // console.log('[Email] Password length:', emailPass?.length || 0);

    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Use TLS
        auth: {
            user: emailUser,
            pass: emailPass
        },
        tls: {
            rejectUnauthorized: false
        }
    });
};

// Test email configuration endpoint
reportRouter.get('/test-email', async (req, res) => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        res.status(200).json({
            success: true,
            message: 'Email configuration is correct!',
            user: process.env.EMAIL_USER
        });
    } catch (error) {
        console.error('Email configuration test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            hint: 'Generate a new App Password at: https://myaccount.google.com/apppasswords'
        });
    }
});

// Send bug report email
reportRouter.post('/send-report', async (req, res) => {
    try {
        const { userEmail, description, screenshot, url, timestamp } = req.body;

        if (!userEmail || !description) {
            return res.status(400).json({ error: 'User email and description are required' });
        }

        const transporter = createTransporter();

        // Prepare email content
        const htmlContent = `
            <h2 style="color: #ef4444;">Bug Report</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>From:</strong> ${userEmail}</p>
                <p><strong>Timestamp:</strong> ${new Date(timestamp).toLocaleString()}</p>
                <p><strong>Page URL:</strong> <a href="${url}">${url}</a></p>
            </div>
            
            <h3 style="color: #374151;">Issue Description:</h3>
            <div style="background: #ffffff; padding: 15px; border-left: 4px solid #ef4444; margin: 15px 0;">
                <p style="white-space: pre-wrap;">${description}</p>
            </div>
            
            ${screenshot ? '<h3 style="color: #374151;">Screenshot:</h3>' : ''}
        `;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to your team email
            replyTo: userEmail, // Allow replying directly to the user
            subject: `🐛 Bug Report from ${userEmail}`,
            html: htmlContent,
            attachments: screenshot ? [{
                filename: `bug-report-${Date.now()}.png`,
                content: screenshot.split('base64,')[1],
                encoding: 'base64'
            }] : []
        };

        await transporter.sendMail(mailOptions);

        // console.log(`Bug report email sent from ${userEmail}`);
        res.status(200).json({ success: true, message: 'Bug report sent successfully' });

    } catch (error) {
        console.error('Error sending bug report email:', error);
        res.status(500).json({ error: 'Failed to send bug report', details: error.message });
    }
});

module.exports = { reportRouter };
