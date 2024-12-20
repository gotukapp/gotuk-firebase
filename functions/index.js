const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");


admin.initializeApp();

// Example HTTPS function to send a notification
exports.sendNotification = functions.https.onRequest(async (req, res) => {
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
exports.startTripNotification = onSchedule("*/30 * * * *", async (event) => {
  console.log("Scheduled function executed at:", new Date().toISOString());
  try {
    const db = admin.firestore();
    const query = db.collection("trips")
        .where("status", "==", "booked")
        .where("date", "<=", new Date(new Date().getTime() + (30 * 60 * 1000)))
        // eslint-disable-next-line max-len
        .where("date", ">=", new Date(new Date().getTime() - (2 * 60 * 60 * 1000)));

    const trips = await query.get();

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
            "\n" + new Date().getTime() < tripDate.getTime() ?
            "Prepare-se: você tem um tour às " + tripTime + "!" :
            "Atenção: este tour já devia ter iniciado às " + tripTime + "!";

        if (guide.exists()) {
          const documentData = guide.data();
          const hasField = "firebaseToken" in documentData;
          if (hasField) {
            // eslint-disable-next-line max-len
            const message = getMessage(title, body, null, guide.get("firebaseToken"));
            const response = await admin.messaging().send(message);
            console.info("Notification sent successfully", response);
          }
        }

        title = new Date().getTime() < tripDate.getTime() ?
            "Seu tour começa em breve!" :
            "Tem um tour por iniciar!";

        body = tourName +
            "\n" + new Date().getTime() < tripDate.getTime() ?
            "Não perca: seu tour começa às " + tripTime + "!" :
            "Urgente: seu tour deveria ter iniciado às " + tripTime + "!";

        if (client.exists()) {
          const documentData = client.data();
          const hasField = "firebaseToken" in documentData;
          if (hasField) {
            // eslint-disable-next-line max-len
            const message = getMessage(title, body, null, client.get("firebaseToken"));
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
    async ({data}) => {
      try {
        if (data.get("status") !== "pending") {
          return;
        }
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
            const body = tripDate.toLocaleString("pt-PT") + " - " + tourName +
                "\nEntre na App para aceitar a viagem.";

            const message = getMessage("Novo Go Now",
                body,
                null,
                guide.get("firebaseToken"));

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

// eslint-disable-next-line require-jsdoc
function getMessage(title, body, data, token) {
  return {
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
}
