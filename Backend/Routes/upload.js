const express = require('express');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, R2_CONFIG } = require('../config/r2.config');

const uploadRouter = express.Router();

uploadRouter.post('/upload-screenshot', async (req, res) => {
    try {
        const { image, uid } = req.body;

        if (!image || !uid) {
            return res.status(400).json({ error: 'Image and User ID are required' });
        }

        // Remove header if present (e.g., "data:image/png;base64,")
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        const filename = `screenshot-${uid}-${Date.now()}.png`;

        const command = new PutObjectCommand({
            Bucket: R2_CONFIG.bucket,
            Key: filename,
            Body: buffer,
            ContentType: 'image/png',
        });

        await r2Client.send(command);

        const publicUrl = `${R2_CONFIG.publicUrl}/${filename}`;

        res.status(200).json({
            message: 'Screenshot uploaded successfully',
            url: publicUrl
        });

    } catch (error) {
        console.error('Error uploading screenshot:', error);
        res.status(500).json({ error: 'Failed to upload screenshot' });
    }
});

module.exports = { uploadRouter };
