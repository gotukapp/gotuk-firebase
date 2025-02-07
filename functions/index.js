const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");


admin.initializeApp();

// Example HTTPS function to send a notification
exports.sendNotification = functions.https.onRequest(
    async (req, res) => {
      try {
        const {token, topic, title, body, data} = req.body;

        const message = getMessage(title, body, data, token, topic);

        const response = await admin.messaging().send(message);
        // eslint-disable-next-line max-len
        res.status(200).send({message: "Notification sent successfully", response});
      } catch (error) {
        console.error("Error sending notification:", error);
        // eslint-disable-next-line max-len
        res.status(500).send({error: "Failed to send notification", details: error});
      }
    });

// eslint-disable-next-line max-len
exports.startTripNotification = onSchedule("*/30 7-22 * * *",
    async (event) => {
      console.info("Scheduled function executed at:", new Date().toISOString());
      try {
        const db = admin.firestore();
        const queryStartTrips = db.collection("trips")
            .where("status", "==", "booked")
            .where("date", "<=", new Date(new Date().getTime() +
                (30 * 60 * 1000)))
        // eslint-disable-next-line max-len
            .where("date", ">=", new Date(new Date().getTime() -
                (2 * 60 * 60 * 1000)));

        const trips = await queryStartTrips.get();

        for (const trip of trips.docs) {
          try {
            const tour = await trip.get("tourId").get();
            const tourName = tour.get("name");
            const guide = await trip.get("guideRef").get();
            const client = await trip.get("clientRef").get();
            const tripDate = trip.get("date").toDate();

            const tripTime = tripDate.toLocaleTimeString("pt-PT",
                {hour: "2-digit", minute: "2-digit"});

            let title = new Date().getTime() < tripDate.getTime() ?
            "Próximo tour começa em breve!" :
            "Tem um tour por iniciar!";

            let body = tourName +
            "\n" + (new Date().getTime() < tripDate.getTime() ?
            "Prepare-se: você tem um tour às " + tripTime + "!" :
            "Atenção: este tour já devia ter iniciado às " + tripTime + "!");

            if (guide.exists) {
              const documentData = guide.data();
              const hasField = "firebaseToken" in documentData;
              if (hasField) {
                // eslint-disable-next-line max-len
                const message = getMessage(title, body, {"tripId": tour.id}, guide.get("firebaseToken"));
                const response = await admin.messaging().send(message);
                console.info("Notification sent successfully", response);
              }
            }

            title = new Date().getTime() < tripDate.getTime() ?
            "O seu tour começa em breve!" :
            "Tem um tour por iniciar!";

            body = tourName +
            "\n" + (new Date().getTime() < tripDate.getTime() ?
            "Não perca: o seu tour começa às " + tripTime + "!" :
            "Urgente: o seu tour deveria ter iniciado às " + tripTime + "!");

            if (client.exists) {
              const documentData = client.data();
              const hasField = "firebaseToken" in documentData;
              if (hasField) {
                // eslint-disable-next-line max-len
                const message = getMessage(title, body, {"tripId": tour.id}, client.get("firebaseToken"));
                const response = await admin.messaging().send(message);
                console.info("Notification sent successfully", response);
              }
            }
          } catch (error) {
            console.error("Error sending notification", trip, error);
          }
        }

        const queryEndTrips = db.collection("trips")
            .where("status", "==", "started")
        // eslint-disable-next-line max-len
            .where("date", ">=", new Date(new Date().getTime() + (2 * 60 * 60 * 1000)))
        // eslint-disable-next-line max-len
            .where("date", "<=", new Date(new Date().getTime() + (4 * 60 * 60 * 1000)));

        const endTripsToProcess = await queryEndTrips.get();

        for (const trip of endTripsToProcess.docs) {
          try {
            const tour = await trip.get("tourId").get();
            const tourName = tour.get("name");
            const tourDurationSlots= tour.get("durationSlots");
            const guide = await trip.get("guideRef").get();
            const tripFinishDate = new Date(
                trip.get("date").toDate().getTime() +
                ((tourDurationSlots-1) * 60));

            const tripTime = tripFinishDate.toLocaleTimeString("pt-PT",
                {hour: "2-digit", minute: "2-digit"});

            const title = "Tem um tour por finalizar!";

            // eslint-disable-next-line max-len
            const body = tourName + "\nAtenção: este tour já devia terminado às " + tripTime + "!";

            if (guide.exists) {
              const documentData = guide.data();
              const hasField = "firebaseToken" in documentData;
              if (hasField) {
                // eslint-disable-next-line max-len
                const message = getMessage(title, body, {"tripId": tour.id}, guide.get("firebaseToken"));
                const response = await admin.messaging().send(message);
                console.info("Notification sent successfully", response);
              }
            }
          } catch (error) {
            console.error("Error sending notification", trip, error);
          }
        }
      } catch (error) {
        console.error("Error executing scheduled task:", error);
      }

      return null;
    });

exports.newTripNotification = onDocumentCreated("trips/{docId}",
    async (event) => {
      try {
        if (event.data.get("status") === "pending") {
          const tour = await event.data.get("tourId").get();
          const tripDate = event.data.get("date").toDate();
          const filteredGuides = await getAvailableGuides(event.data, tour);

          for (const guide of filteredGuides) {
            await sendGoNowNotification(guide, tripDate, tour);
          }
        }

        if (event.data.get("status") === "booked") {
          const guideRef = event.data.get("guideRef");
          await createNotificationDocument(guideRef,
              event.data.ref,
              "",
              "service booked");
        }
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    });

// Function to handle new document in collection 'b'
// eslint-disable-next-line max-len
exports.onCreateChatMessage = onDocumentCreated("chat/{chatId}/messages/{messageId}",
    async (event) => {
      const db = admin.firestore();

      const userRef = db.collection("users").doc(event.data.get("to"));
      const tripRef = db.collection("trips").doc(event.params.chatId);

      await createNotificationDocument(
          userRef,
          tripRef,
          event.data.get("text"),
          "message");
    });

// eslint-disable-next-line require-jsdoc
async function sendGoNowNotification(guide, tripDate, tour) {
  try {
    const body = tripDate.toLocaleString("pt-PT") + " - " + tour.get("name") +
        "\nEntre na App para aceitar a viagem.";

    const message = getMessage("Novo Go Now",
        body,
        {"tripId": tour.id},
        guide.get("firebaseToken"));

    // Send the message
    const response = await admin.messaging().send(message);

    console.info("Notification sent successfully", response);
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

// eslint-disable-next-line require-jsdoc
async function getAvailableGuides(data, tour) {
  const db = admin.firestore();
  const tripDate = data.get("date").toDate();
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

  return querySnapshot.docs.filter((doc) =>
    !guidesUnavailable.includes(doc.id));
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

// Function to create document in collection 'c'
// eslint-disable-next-line require-jsdoc
async function createNotificationDocument(userRef, tripRef, content, type) {
  try {
    const db = admin.firestore();

    await db.collection("notifications").add({
      type: type,
      tripRef: tripRef,
      userRef: userRef,
      status: "new",
      content: content,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding document to collection 'c'", error);
  }
}
