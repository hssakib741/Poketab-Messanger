console.log('Initializing Server');
import path from 'path';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import crypto from 'crypto';
//utility functions for the server
import { validateUserName, validateAvatar, avList, validateKey } from './utils/validation.js';
import { generateUniqueId, makeUsernameandPasswordForDevelopment } from './utils/functions.js';
import { blockedMessage } from './utils/blockedMessage.js';
import { keyStore } from './database/db.js';
import cookieParser from 'cookie-parser';
//import .env variables
import { config } from 'dotenv';
import express, { app, HMAC_KEY, server } from './expressApp.js';
import './websockets.js';
import './fileSocket.js';
import './preAuthSocket.js';
config();
//versioning and developer name
const version = process.env.npm_package_version || 'Development';
const developer = 'Fuad Hasan';
//this blocks the client if they request 100 requests in 15 minutes
const apiRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: blockedMessage,
    standardHeaders: false,
    legacyHeaders: false // Disable the `X-RateLimit-*` headers
});
const __dirname = process.cwd();
//console.log(__dirname);
//public path to serve static files
const publicPath = path.join(__dirname, '/public');
//console.log(publicPath);
const port = process.env.PORT || 3000;
const ENVIRONMENT = process.env.BUILD_MODE == 'DEVELOPMENT' ? 'DEVELOPMENT' : 'PRODUCTION';
const Icon = ENVIRONMENT == 'DEVELOPMENT' ? 'dev.png' : 'icon.png';
//disable x-powered-by header showing express in the response
app.disable('x-powered-by');
//view engine setup
app.set('views', path.join(publicPath, '/views'));
app.set('view engine', 'ejs'); //set the view engine to ejs [embedded javascript] to allow for dynamic html
app.set('trust proxy', 1);
//allow cross origin requests only from the client on poketab.live
app.use(cors());
app.use(compression()); //compress all responses
app.use(express.static(publicPath)); //serve static files from the public folder
app.use(express.json()); //parse json data
//parse url encoded data in the body of the request
app.use(express.urlencoded({
    extended: false
}));
app.use(cookieParser(HMAC_KEY));
app.use(apiRequestLimiter); //limit the number of requests to 100 in 15 minutes
// default route to serve the client
// Home route
app.get('/', (_, res) => {
    // Generate a random nonce
    const nonce = crypto.randomBytes(16).toString('hex');
    // Set the Content-Security-Policy header
    res.setHeader('Content-Security-Policy', `default-src 'self'; style-src 'self' 'nonce-${nonce}' ; img-src 'self' data:;`);
    // Set the Developer header
    res.setHeader('Developer', 'Fuad Hasan');
    // Render the home page
    res.render('home/home', { title: 'Get Started', hash: nonce, version: `v.${version}`, icon: Icon });
});
import adminRouter from './routes/admin.js';
import fileRouter from './routes/fileAPI.js';
app.use('/admin', adminRouter); //route for admin panel
app.use('/api/files', fileRouter); //route for file uploads
app.get('/create', (req, res) => {
    const nonce = crypto.randomBytes(16).toString('hex');
    res.setHeader('Content-Security-Policy', `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}';`);
    res.setHeader('Developer', 'Fuad Hasan');
    //create a key and send it to the client as cookie
    const key = generateUniqueId();
    //st cookie for 2 minutes
    res.cookie('key', key, { maxAge: 120000, httpOnly: true, signed: true, sameSite: 'strict' });
    res.render('login/newUser', { title: 'Create', avList: avList, key: null, version: `v.${version}`, hash: nonce, takenAvlists: null, cookieCreated: Date.now(), icon: Icon });
});
app.get('/join', (_, res) => {
    const nonce = crypto.randomBytes(16).toString('hex');
    res.setHeader('Content-Security-Policy', `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}';`);
    res.setHeader('Developer', 'Fuad Hasan');
    res.clearCookie('key');
    res.render('login/newUser', { title: 'Join', avList: avList, version: `v.${version}`, key: null, hash: nonce, takenAvlists: null, icon: Icon });
});
app.get('/join/:key', (req, res) => {
    if (validateKey(req.params.key)) {
        if (keyStore.hasKey(req.params.key)) {
            //if key is full, redirect to join page
            if (keyStore.isFull(req.params.key)) {
                blockNewChatRequest(res, { title: 'Chat full', errorCode: '772', errorMessage: 'Maximum user reached', buttonText: 'Back', icon: 'block.png' });
                return;
            }
            const takenAvlists = keyStore.getUserList(req.params.key).map((user) => user.avatar);
            const nonce = crypto.randomBytes(16).toString('hex');
            res.setHeader('Content-Security-Policy', `default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline' 'self'; script-src 'self' 'nonce-${nonce}';`);
            res.setHeader('Developer', 'Fuad Hasan');
            res.render('login/newUser', { title: 'Join', avList: avList, version: `v.${version}`, key: req.params.key, hash: nonce, takenAvlists: takenAvlists, icon: Icon });
            return;
        }
        else {
            blockNewChatRequest(res, { title: 'Doesn\'t exist', errorCode: '404', errorMessage: 'Key does not exist', buttonText: 'Back', icon: 'error.png' });
            return;
        }
    }
    else {
        blockNewChatRequest(res, { title: 'Invalid', errorCode: '400', errorMessage: 'Key is not Valid', buttonText: 'Back', icon: 'error.png' });
        return;
    }
});
app.get('/chat', (_, res) => {
    if (ENVIRONMENT != 'DEVELOPMENT') {
        res.redirect('/join');
    }
    else {
        const { username, avatar } = makeUsernameandPasswordForDevelopment('00-000-00');
        approveNewChatRequest(res, { username: username, key: '00-000-00', avatar: avatar, max_users: 10, icon: Icon });
    }
});
app.post('/chat', (req, res) => {
    //get the Username and avatar from the pre-request
    const username = req.body.username;
    const avatar = req.body.avatar;
    //validate username and avatar
    const isValidUsername = validateUserName(username);
    //if username and avatars are not valid
    if (!isValidUsername || !validateAvatar(avatar)) {
        res.setHeader('Developer', 'Fuad Hasan');
        res.setHeader('Content-Security-Policy', 'script-src \'none\'');
        res.status(400).send({
            error: !isValidUsername ?
                'Invalid username'
                : 'Invalid avatar'
        });
    }
    //If no problem so far,
    //get the key from the request
    let key = req.body.key;
    //if key was not supplied that means the request was a create request.
    if (!key) {
        //Create request
        //get the key from the cookie which was delivered when the /create page was requested. 
        // NOTE: The cookie will be there for 2 minutes
        const cookie = req.signedCookies.key;
        //console.log(req.signedCookies.key);
        //if the cookie is present
        if (cookie) {
            const regex = /[a-zA-Z0-9]{2}-[a-zA-Z0-9]{3}-[a-zA-Z0-9]{2}/;
            const match = cookie.match(regex);
            key = match ? match[0] : undefined;
            //if a key found and it is valid
            if (key && validateKey(key)) {
                //if key does not exist in the keyStore
                if (!keyStore.hasKey(key)) {
                    //console.log(`Valid Key found: ${key}! Creating new chat`);
                    approveNewChatRequest(res, { username: username, key: key, avatar: avatar, max_users: req.body.maxuser, icon: Icon });
                    return;
                }
                else {
                    //clash of keys
                    //console.log(`Key clash found: ${key}!`);
                    res.setHeader('Developer', 'Fuad Hasan');
                    res.setHeader('Content-Security-Policy', 'script-src \'none\'');
                    res.status(400).send({ error: 'Key clased!' });
                    return;
                }
            }
            else {
                //console.log('Invalid key found in cookie');
                res.setHeader('Developer', 'Fuad Hasan');
                res.setHeader('Content-Security-Policy', 'script-src \'none\'');
                res.status(400).send({ error: 'Invalid key' });
                return;
            }
        }
        else {
            //console.log('No Key or Cookie found in cookie');
            //console.log('No session found for this request.');
            blockNewChatRequest(res, { title: 'Not found', errorCode: '498', errorMessage: 'Session Key not found', buttonText: 'Home', icon: 'session.png' });
            return;
        }
    }
    else if (key && keyStore.hasKey(key)) {
        //Key exists, so the request is a join request
        //console.log(`Existing Key found: ${key}!\nChecking permissions...`);
        //Check if the key has reached the maximum user limit
        if (keyStore.getKey(key).activeUsers >= keyStore.getKey(key).maxUser) {
            //console.log(`Maximum user reached. User is blocked from key: ${key}`);
            blockNewChatRequest(res, { title: 'Unauthorized', errorCode: '401', errorMessage: 'Access denied', buttonText: 'Suicide', icon: 'block.png' });
            return;
        }
        else {
            //if user have room to enter the chat
            //console.log('User have permission to join this chat');
            //console.log(`Redirecting to old chat with key: ${key}`);
            const { maxUser } = keyStore.getKey(key);
            approveNewChatRequest(res, { username: username, key: key, avatar: avatar, max_users: maxUser, icon: Icon });
            return;
        }
    }
    else {
        //console.log('No session found for this request.');
        blockNewChatRequest(res, { title: 'Not found', errorCode: '498', errorMessage: 'Session Key not found', buttonText: 'Renew', icon: 'session.png' });
        return;
    }
});
function blockNewChatRequest(res, data) {
    res.setHeader('Developer', 'Fuad Hasan');
    res.setHeader('Content-Security-Policy', 'script-src \'none\'');
    res.clearCookie('key');
    res.render('errors/errorRes', { title: data.title, errorCode: data.errorCode, errorMessage: data.errorMessage, buttonText: data.buttonText, icon: data.icon });
}
function approveNewChatRequest(res, data) {
    const uid = crypto.randomUUID();
    const nonce = crypto.randomBytes(16).toString('hex');
    const welcomeSticker = Math.floor(Math.random() * 9) + 1;
    res.setHeader('Developer', 'Fuad Hasan');
    res.setHeader('Content-Security-Policy', 'default-src \'self\'; img-src \'self\' data: blob:; style-src \'self\' \'unsafe-inline\'; connect-src \'self\' blob:; media-src \'self\' blob:;');
    res.setHeader('Cluster', `ID: ${process.pid}`);
    res.render('chat/chat', { myName: data.username, myKey: data.key, myId: uid, myAvatar: data.avatar, maxUser: data.max_users, version: `${version}`, developer: developer, ENV: ENVIRONMENT, hash: nonce, welcomeSticker: welcomeSticker, icon: data.icon });
}
app.get('/offline', (_, res) => {
    res.setHeader('Developer', 'Fuad Hasan');
    res.setHeader('Content-Security-Policy', 'script-src \'none\'');
    res.render('errors/errorRes', { title: 'Offline', errorCode: 'Oops!', errorMessage: 'You are offline :(', buttonText: 'Refresh', icon: 'offline.png' });
});
app.get('*', (_, res) => {
    res.setHeader('Developer', 'Fuad Hasan');
    res.setHeader('Content-Security-Policy', 'script-src \'none\'');
    res.render('errors/errorRes', { title: 'Page not found', errorCode: '404', errorMessage: 'Page not found', buttonText: 'Home', icon: '404.png' });
});
//fire up the server
server.listen(port, () => {
    console.log('%cBooting up the server...', 'color: yellow;');
    console.log(`Server is up on port ${port} | Process ID: ${process.pid} in ${ENVIRONMENT} mode`);
    const HOOK_API_KEY = process.env.HOOK_API_KEY;
    const CHAT_ID = process.env.CHAT_ID;
    if (ENVIRONMENT === 'PRODUCTION' && HOOK_API_KEY && CHAT_ID) {
        fetch(`https://api.telegram.org/bot${HOOK_API_KEY}/sendMessage?chat_id=${CHAT_ID}&text=Server is up on port ${port} | Process ID: ${process.pid} in ${ENVIRONMENT} mode`, { method: 'GET' });
    }
});
//# sourceMappingURL=server.js.map