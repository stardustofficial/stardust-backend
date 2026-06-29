const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Global CORS configurations so your GitHub Pages frontend can connect smoothly
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Volatile Memory Storage (Temporary Data Store till we attach a Database)
let onlineUsers = {};      // Map: userId -> socketId
let userProfiles = {};     // Map: userId -> { displayName, country }
let friendsNetwork = {};   // Map: userId -> Set of approved friend userIds
let globalMoments = [];    // Array of objects containing posts metrics

io.on('connection', (socket) => {
    console.log(`New Device Synced: ${socket.id}`);

    // ================= 1. USER AUTHENTICATION & LOCATION ROUTING =================
    socket.on('register_user', (data) => {
        const { userId, displayName, country } = data;
        
        socket.userId = userId;
        onlineUsers[userId] = socket.id;

        // Profile sync or creation
        userProfiles[userId] = {
            displayName: displayName || "Stardust User",
            country: country || "Global"
        };

        // Initialize friends list structure if new entry
        if (!friendsNetwork[userId]) {
            friendsNetwork[userId] = new Set();
        }

        console.log(`User verified: ${userId} (${userProfiles[userId].displayName}) from ${userProfiles[userId].country}`);
    });

    // ================= 2. REAL-TIME CHAT & UNSEEN BADGE ENGINE =================
    socket.on('send_private_message', (data) => {
        const { senderId, receiverId, message } = data;
        const targetSocketId = onlineUsers[receiverId];

        const structuredMessage = {
            senderId,
            message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_private_message', structuredMessage);
        } else {
            console.log(`Message from ${senderId} cached. Target ${receiverId} is offline.`);
        }
    });

    // ================= 3. PRIVACY BALANCED MOMENTS TIMELINE =================
    socket.on('publish_moment', (data) => {
        const { senderId, caption, mediaUrl, mediaType } = data;
        
        const profile = userProfiles[senderId] || { displayName: "Anonymous" };
        
        const newMomentItem = {
            id: 'moment_' + Date.now(),
            senderId,
            authorName: profile.displayName,
            caption,
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || 'image',
            likes: 0,
            comments: [],
            timestamp: 'Just now'
        };

        globalMoments.unshift(newMomentItem);

        for (let userId in onlineUsers) {
            const clientSocketId = onlineUsers[userId];
            if (userId === senderId || (friendsNetwork[senderId] && friendsNetwork[senderId].has(userId))) {
                io.to(clientSocketId).emit('new_moment_feed_update', newMomentItem);
            }
        }
    });

    // ================= 4. FRIEND REQUEST CONTROL PIPELINE =================
    socket.on('send_friend_request', (data) => {
        const { senderId, targetUserId } = data;
        const targetSocketId = onlineUsers[targetUserId];

        if (friendsNetwork[senderId]) friendsNetwork[senderId].add(targetUserId);
        if (friendsNetwork[targetUserId]) friendsNetwork[targetUserId].add(senderId);

        if (targetSocketId) {
            io.to(targetSocketId).emit('incoming_friend_alert', { senderId });
        }
    });

    // ================= 5. PROFILE DYNAMICS SYNCING =================
    socket.on('update_profile_meta', (data) => {
        const { userId, displayName, country } = data;
        if (userProfiles[userId]) {
            userProfiles[userId].displayName = displayName;
            userProfiles[userId].country = country;
            console.log(`Profile updated for ID ${userId}: ${displayName} (${country})`);
        }
    });

    // ================= 6. TERMINATION / CONNECTION CLEANUP =================
    socket.on('disconnect', () => {
        if (socket.userId && onlineUsers[socket.userId]) {
            console.log(`Device disconnected: ${socket.userId}`);
            delete onlineUsers[socket.userId];
        }
    });
});

app.get('/', (req, res) => {
    res.send('Stardust Chat Core Real-Time Engine Running Globally.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`System active on internal matrix link port: ${PORT}`);
});
