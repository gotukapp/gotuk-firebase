// eslint-disable-next-line require-jsdoc

const admin = require("firebase-admin");

// eslint-disable-next-line require-jsdoc
async function sendFirebaseNotification(title, body, data, token, topic) {
  const message = getMessage(title, body, data, token, topic);
  const response = await admin.messaging().send(message);
  console.info("Notification sent successfully", response);
}

// eslint-disable-next-line require-jsdoc
function getMessage(title, body, data, token) {
  const message = {
    notification: {
      title: title || "Default Title",
      body: body || "Default Body",
    },
    android: {
      notification: {
        sound: "default",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
    data: data || {},
    token: token,
    topic: null,
  };
  console.info(message);
  return message;
}

exports.sendFirebaseNotification = sendFirebaseNotification;
