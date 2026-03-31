var express = require('express');
var router = express.Router();
let messageModel = require('../schemas/messages');
let { CheckLogin } = require('../utils/authHandler');
let { uploadAny } = require('../utils/uploadHandler');

// GET / - lấy tin nhắn cuối cùng của mỗi cuộc trò chuyện của user hiện tại
router.get('/', CheckLogin, async function (req, res) {
    try {
        let currentUserId = req.user._id;

        // Lấy tất cả tin nhắn liên quan đến user hiện tại
        let messages = await messageModel.find({
            $or: [
                { from: currentUserId },
                { to: currentUserId }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl');

        // Lấy tin nhắn cuối cùng của mỗi cuộc trò chuyện (theo partner)
        let conversationMap = new Map();

        for (let msg of messages) {
            // Xác định partner (người kia trong cuộc trò chuyện)
            let partnerId = msg.from._id.toString() === currentUserId.toString()
                ? msg.to._id.toString()
                : msg.from._id.toString();

            if (!conversationMap.has(partnerId)) {
                conversationMap.set(partnerId, msg);
            }
        }

        let result = Array.from(conversationMap.values());
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /:userID - lấy toàn bộ tin nhắn giữa user hiện tại và userID
router.get('/:userID', CheckLogin, async function (req, res) {
    try {
        let currentUserId = req.user._id;
        let targetUserId = req.params.userID;

        let messages = await messageModel.find({
            $or: [
                { from: currentUserId, to: targetUserId },
                { from: targetUserId, to: currentUserId }
            ]
        })
            .sort({ createdAt: 1 })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl');

        res.send(messages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST /:userID - gửi tin nhắn đến userID (text hoặc file)
router.post('/:userID', CheckLogin, uploadAny.single('file'), async function (req, res) {
    try {
        let currentUserId = req.user._id;
        let targetUserId = req.params.userID;

        let messageContent;

        if (req.file) {
            // Có file đính kèm
            messageContent = {
                type: 'file',
                text: req.file.path
            };
        } else if (req.body.text) {
            // Tin nhắn text
            messageContent = {
                type: 'text',
                text: req.body.text
            };
        } else {
            return res.status(400).send({ message: 'Nội dung tin nhắn không được rỗng' });
        }

        let newMessage = new messageModel({
            from: currentUserId,
            to: targetUserId,
            messageContent: messageContent
        });

        await newMessage.save();
        await newMessage.populate('from', 'username fullName avatarUrl');
        await newMessage.populate('to', 'username fullName avatarUrl');

        res.send(newMessage);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
