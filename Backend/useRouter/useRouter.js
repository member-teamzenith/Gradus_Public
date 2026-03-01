// Routes/index.js
const express = require('express');
// Removed pathway/playlist-related routers
const { searchRouter } = require('../Routes/search.js');
const { onBoardingRouter } = require('../Routes/onBoarding.js');
const { profileRouter } = require('../Routes/profile.js')
const { loginRouter } = require('../Routes/login.js');
const {videoPlayerRouter} = require('../Routes/videoplayer.js');
const {videoRouter} = require('../Routes/videos.js');
const {playlistRouter} = require('../Routes/playlists.js');
const tokensUsageRouter = require('../Routes/tokensUsage.js');
const {savedPlaylistRouter} = require('../Routes/savedPlaylist.js');
const {noteBookRouter} = require('../Routes/notebooks.js');
const {blueprintsRouter} = require('../Routes/blueprints.js');
const {reportRouter} = require('../Routes/ReportEmail.js');

const router = express.Router();


router.use(searchRouter);
router.use(onBoardingRouter);
router.use(profileRouter);
router.use(loginRouter);
router.use(videoPlayerRouter);
router.use(videoRouter);
router.use(playlistRouter);
router.use(savedPlaylistRouter);
router.use(noteBookRouter);
router.use(blueprintsRouter);
router.use(reportRouter);
router.use('/api/tokens', tokensUsageRouter);
module.exports = { router };
