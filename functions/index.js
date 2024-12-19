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

const {
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");

exports.newTripNotification = onDocumentCreated("trips/{docId}",
    async ({data}) => {
      try {
        const db = admin.firestore();
        const tour = await data.get("tourId").get();
        const tourName = tour.get("name");
        const tripDate = await data.get("date").toDate();
        const hourSliderValue = tripDate.getHours();
        const minutesSliderValue = tripDate.getMinutes();
        const guidesUnavailable = []; // List of unavailable guides

        const formatter = new Intl.DateTimeFormat("pt-PT",
            {year: "numeric", month: "2-digit", day: "2-digit"});
        const formatedTripDate = formatter.format(tripDate);

        const unavailabilityRef = await db.collection("unavailability")
            .doc(formatedTripDate).get();
        if (unavailabilityRef.exists) {
          const durationSlots = tour.get("durationSlots");
          for (let i = 0; i < durationSlots; i++) {
            const totalMinutes =
                (hourSliderValue * 60) + minutesSliderValue + (i * 30);
            const newHour =
                Math.floor(totalMinutes / 60); // Integer division for hours
            const newMinutes = totalMinutes % 60; // Remainder for minutes

            // eslint-disable-next-line max-len
            const hour = `${newHour.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`;

            const fieldData = unavailabilityRef.get(hour);

            if (Array.isArray(fieldData)) {
              fieldData.forEach((guide) => {
                if (!guidesUnavailable.includes(guide)) {
                  guidesUnavailable.add(guide);
                }
              });
            }
          }
        }

        let guides = db.collection("users")
            .where("accountValidated", "==", true);

        if (data.get("onlyElectricVehicles")) {
          guides = guides.where("tuktukElectric", "==", true);
        }

        if (data.get("guideLang").length !== 0) {
          guides = guides.where("language", "array-contains-any",
              data.get("guideLang").toLowerCase().split(" "));
        }

        guides.where("tuktukSeats", ">=", data.get("persons"));

        const querySnapshot = await guides.get();

        const filteredGuides = querySnapshot.docs.filter((doc) =>
          !guidesUnavailable.includes(doc.id));

        for (const guide of filteredGuides) {
          try {
            const message = {
              notification: {
                title: "Novo Go Now",
                body: tripDate.toLocaleString("pt-PT") + " - " + tourName +
                    "\nEntre na App para aceitar a viagem.",
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
              data: {}, // Custom key-value pairs
              // eslint-disable-next-line max-len
              token: guide.get("firebaseToken"),
              topic: null,
            };
            // Send the message
            const response = await admin.messaging().send(message);

            console.info("Notification sent successfully", response);
          } catch (error) {
            console.error("Error sending notification:", error);
          }
        }
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    });
