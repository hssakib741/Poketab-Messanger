//buit in modules
const crypto = require('crypto');

//utility functions for the server
const { keyformat } = require('./utils/functions');
const { io } = require('./websockets');
const { Keys } = require('./credentialManager');
//importing worker threads
//The worker threads module provides a way to create multiple environments running on separate threads that can communicate with each other via inter-thread messaging or sharing memory.
const auth = io.of('/auth');

function keyCheck(key){
	try{
		if (!keyformat.test(key)){
			return {success: false, message: 'Invalid Key'};
		}

		const keyExists = Keys.hasKey(key);

		if (keyExists){
		//check if key has space for more users
			const max_users = Keys[key].maxUser;
			const userCount = Keys[key].userCount;
			//console.log(`Key ${key} has ${userCount} users out of ${max_users} | ${Keys[key]}`);
			if (userCount >= max_users){
				return {success: false, message: 'Not Authorized. Key is full'};
			}else{
			//allow user to join
				const data = Keys.getUserList(key).map((user) => { return {hash: crypto.createHash('sha256').update(user.username).digest('hex'), name: user.username, avatar: user.avatar}; });
				return {success: true, message: data};
			}
		} else {
			return {success: false, message: 'Key does not exist'};
		}	

	}catch(err){
		console.log(err);
	}
}

auth.on('connection', (socket) => {
	socket.on('joinRequest', ( key, callback) => {
		try{
			//console.log('joinRequest received');
			callback(keyCheck(key));			
		}catch(err){
			console.log(err);
		}
	});
});

// Path: server\authSocket.js
module.exports = { auth };