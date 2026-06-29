const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware system configuration
app.use(cors({ origin: "*" }));
app.use(express.json());

// Root path handler so Render knows the service is active instantly
app.get('/', (req, res) => {
    res.send('Stardust Service Online');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let onlineUsers = {};      
let userProfiles = {};     
let friendsNetwork = {};   
let globalMoments = [];    

io.on('connection', (socket) => {
    console.log('Device connected: ' + socket.id);

    socket.on('register_user', (data) => {
        const { userId, displayName, country } = data;
        socket.userId = userId;
        onlineUsers[userId] = socket.id;
        userProfiles[userId] = { displayName: displayName || "User", country: country || "Global" };
        if (!friendsNetwork[userId]) friendsNetwork[userId] = new Set();
        console.log('User registered: ' + userId);
    });

    socket.on('send_private_message', (data) => {
        const { senderId, receiverId, message } = data;
        const targetSocketId = onlineUsers[receiverId];
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_private_message', { senderId, message });
        }
    });

    socket.on('publish_moment', (data) => {
        const { senderId, caption } = data;
        const profile = userProfiles[senderId] || { displayName: "Anonymous" };
        const newMoment = {
            id: 'm_' + Date.now(),
            senderId,
            authorName: profile.displayName,
            caption,
            timestamp: 'Just now'
        };
        globalMoments.unshift(newMoment);
        io.emit('new_moment_feed_update', newMoment);
    });

    socket.on('send_friend_request', (data) => {
        const { senderId, targetUserId } = data;
        if (friendsNetwork[senderId]) friendsNetwork[senderId].add(targetUserId);
        if (friendsNetwork[targetUserId]) friendsNetwork[targetUserId].add(senderId);
        const targetSocketId = onlineUsers[targetUserId];
        if (targetSocketId) {
            io.to(targetSocketId).emit('incoming_friend_alert', { senderId });
        }
    });

    socket.on('disconnect', () => {
        if (socket.userId && onlineUsers[socket.userId]) {
            delete onlineUsers[socket.userId];
        }
    });
});

// Start listening immediately
server.listen(PORT, () => {
    console.log('Server bound successfully to port: ' + PORT);
});
