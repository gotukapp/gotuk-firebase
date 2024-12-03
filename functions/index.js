const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Example HTTPS function to send a notification
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  try {
    // The notification payload
    const payload = {
      notification: {
        title: req.body.title || "Default Title",
        body: req.body.body || "Default Body",
      },
    };

    // Target device token or topic
    const tokenOrTopic = req.body.token || req.body.topic;

    if (!tokenOrTopic) {
      res.status(400).send("Missing 'token' or 'topic' in request body");
      return;
    }

    // eslint-disable-next-line max-len
    const response = await admin.messaging().sendToDevice(tokenOrTopic, payload);
    res.status(200).send({message: "Notification sent successfully", response});
  } catch (error) {
    console.error("Error sending notification:", error);
    // eslint-disable-next-line max-len
    res.status(500).send({error: "Failed to send notification", details: error});
  }
});
