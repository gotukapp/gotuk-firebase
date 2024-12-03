const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Example HTTPS function to send a notification
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  try {
    // Target device token or topic
    const {token, topic, title, body, data} = req.body;


    // Construct the message payload
    const message = {
      notification: {
        title: title || "Default Title",
        body: body || "Default Body",
      },
      data: data || {}, // Custom key-value pairs
      token: token, // Target a specific device
      topic: topic, // Or target a topic
    };

    // Send the message
    const response = await admin.messaging().send(message);
    // eslint-disable-next-line max-len
    res.status(200).send({message: "Notification sent successfully", response});
  } catch (error) {
    console.error("Error sending notification:", error);
    // eslint-disable-next-line max-len
    res.status(500).send({error: "Failed to send notification", details: error});
  }
});
