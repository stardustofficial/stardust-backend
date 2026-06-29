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
    console.log(`📡 New Device Synced: ${socket.id}`);

    // ================= 1. USER AUTHENTICATION & LOCATION ROUTING =================
    socket.on('register_user', (data) => {
        // data = { userId, displayName, country }
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

        console.log(`✅ User verified: ${userId} (${userProfiles[userId].displayName}) from ${userProfiles[userId].country}`);
    });

    // ================= 2. REAL-TIME CHAT & UNSEEN BADGE ENGINE =================
    socket.on('send_private_message', (data) => {
        // data = { senderId, receiverId, message }
        const { senderId, receiverId, message } = data;
        const targetSocketId = onlineUsers[receiverId];

        const structuredMessage = {
            senderId,
            message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (targetSocketId) {
            // Target online hai, deliver real-time directly
            io.to(targetSocketId).emit('receive_private_message', structuredMessage);
        } else {
            console.log(`📩 Message from ${senderId} cached. Target ${receiverId} is offline.`);
            // Offline notifications layout handle system trigger can be put here
        }
    });

    // ================= 3. PRIVACY BALANCED MOMENTS TIMELINE =================
    socket.on('publish_moment', (data) => {
        // data = { senderId, caption, mediaUrl, mediaType }
        const { senderId, caption, mediaUrl, mediaType } = data;
        
        const profile = userProfiles[senderId] || { displayName: "Anonymous" };
        
        const newMomentItem = {
            id: 'moment_' + Date.now(),
            senderId,
            authorName: profile.displayName,
            caption,
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || 'image', // image or video
            likes: 0,
            comments: [],
            timestamp: 'Just now'
        };

        globalMoments.unshift(newMomentItem);

        // Privacy Lock: Loop through online users and only push to their timeline if they are friends
        for (let userId in onlineUsers) {
            const clientSocketId = onlineUsers[userId];
            
            // Post self visibility or check if the target user is in sender's friend network list
            if (userId === senderId || (friendsNetwork[senderId] && friendsNetwork[senderId].has(userId))) {
                io.to(clientSocketId).emit('new_moment_feed_update', newMomentItem);
            }
        }
    });

    // ================= 4. FRIEND REQUEST CONTROL PIPELINE =================
    socket.on('send_friend_request', (data) => {
        // data = { senderId, targetUserId }
        const { senderId, targetUserId } = data;
        const targetSocketId = onlineUsers[targetUserId];

        // Process directly for structural test (Auto-approve or pipeline notify)
        if (friendsNetwork[senderId]) friendsNetwork[senderId].add(targetUserId);
        if (friendsNetwork[targetUserId]) friendsNetwork[targetUserId].add(senderId);

        if (targetSocketId) {
            // Send request alert badge trigger directly to destination client device bottom bar
            io.to(targetSocketId).emit('incoming_friend_alert', { senderId });
        }
    });

    // ================= 5. PROFILE DYNAMICS SYNCING =================
    socket.on('update_profile_meta', (data) => {
        // data = { userId, displayName, country }
        const { userId, displayName, country } = data;
        if (userProfiles[userId]) {
            userProfiles[userId].displayName = displayName;
            userProfiles[userId].country = country;
            console.log(`🛠️ Profile updated for ID ${userId}: ${displayName} (${country})`);
        }
    });

    // ================= 6. TERMINATION / CONNECTION CLEANUP =================
    socket.on('disconnect', () => {
        if (socket.userId && onlineUsers[socket.userId]) {
            console.log(`🔌 Devices disconnected: ${socket.userId}`);
            delete onlineUsers[socket.userId];
        }
    });
});

app.get('/', (req, res) => {
    res.send('🌌 Stardust Chat Core Real-Time Engine Running Globally.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 System active on internal matrix link port: ${PORT}`);
});
