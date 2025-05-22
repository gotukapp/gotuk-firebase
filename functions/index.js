const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {sendGuideTripStartWarning,
  sendClientTripStartWarning, sendGuideTripEndWarning,
  selectGuide, updateUserUnavailability, sendClientTripCancelWarning,
  sendGuideTripCancelWarning, sendClientTripAcceptedWarning,
  sendClientTripStarted,
} = require("./tripUtil");
const {defineSecret} = require("firebase-functions/params");
const {sendFirebaseNotification} = require("./firebaseUtil");
const {onDocumentUpdated} = require("firebase-functions/firestore");
const stripeLib = require("stripe");
const STRIPE_SK_LIVE = defineSecret("STRIPE_SK_LIVE");
const STRIPE_SK_TEST = defineSecret("STRIPE_SK_TEST");
const ENDPOINT_SECRET = defineSecret("ENDPOINT_SECRET");
const TEST_ENDPOINT_SECRET = defineSecret("TEST_ENDPOINT_SECRET");

admin.initializeApp();

// eslint-disable-next-line require-jsdoc
async function processPaymentEvent(event) {
  switch (event.type) {
    case "payment_intent.succeeded":
      console.info(event.data.object);
      await savePaymentData(event.data.object);
      break;
    default:
      console.error(`Unhandled event type ${event.type}`);
  }
}

exports.newTestPaymentReceived = functions.https.onRequest(
    {secrets: ["TEST_ENDPOINT_SECRET", "STRIPE_SK_TEST"]},
    async (req, res) => {
      try {
        const sig = req.headers["stripe-signature"];
        let event;
        try {
          const stripe = stripeLib(STRIPE_SK_TEST.value());
          // eslint-disable-next-line max-len
          event = stripe.webhooks.constructEvent(req.rawBody, sig, TEST_ENDPOINT_SECRET.value());
          console.info("event", event);
        } catch (err) {
          console.error("Webhook Error", err);
          res.status(400).send(`Webhook Error: ${err.message}`);
          return;
        }

        await processPaymentEvent(event);

        res.status(200).send();
      } catch (error) {
        console.error("Error processing new payment", error);
        // eslint-disable-next-line max-len
        res.status(500).send({error: "Error processing new payment", details: error});
      }
    });

exports.newPaymentReceived = functions.https.onRequest(
    {secrets: ["ENDPOINT_SECRET", "STRIPE_SK_LIVE"]},
    async (req, res) => {
      try {
        const sig = req.headers["stripe-signature"];
        let event;
        try {
          const stripe = stripeLib(STRIPE_SK_LIVE.value());
          // eslint-disable-next-line max-len
          event = stripe.webhooks.constructEvent(req.rawBody, sig, ENDPOINT_SECRET.value());
          console.info("event", event);
        } catch (err) {
          console.error("Webhook Error", err);
          res.status(400).send(`Webhook Error: ${err.message}`);
          return;
        }

        await processPaymentEvent(event);

        res.status(200).send();
      } catch (error) {
        console.error("Error processing new payment", error);
        // eslint-disable-next-line max-len
        res.status(500).send({error: "Error processing new payment", details: error});
      }
    });

// Example HTTPS function to send a notification
exports.sendNotification = functions.https.onRequest(
    async (req, res) => {
      try {
        const {token, topic, title, body, data} = req.body;
        await sendFirebaseNotification(title, body, data, token, topic);
        // eslint-disable-next-line max-len
        res.status(200).send({message: "Notification sent successfully"});
      } catch (error) {
        console.error("Error sending notification:", error);
        // eslint-disable-next-line max-len
        res.status(500).send({error: "Failed to send notification", details: error});
      }
    });

exports.createStripePayment = functions.https.onRequest(
    {secrets: ["STRIPE_SK_LIVE"]},
    async (req, res) => {
      try {
        const {amount, currency} = req.body;
        const stripe = stripeLib(STRIPE_SK_LIVE.value());
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: currency,
          payment_method_types: ["card"],
        });

        res.send(paymentIntent.client_secret);
      } catch (error) {
        console.error("Error creating stripe payment:", error);
        // eslint-disable-next-line max-len
        res.status(500).send({error: "Failed to create stripe payment", details: error});
      }
    });

exports.createTestStripePayment = functions.https.onRequest(
    {secrets: ["STRIPE_SK_TEST"]},
    async (req, res) => {
      try {
        const {amount, currency} = req.body;
        const stripe = stripeLib(STRIPE_SK_TEST.value());

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: currency,
          payment_method_types: ["card"],
        });

        res.send(paymentIntent.client_secret);
      } catch (error) {
        console.error("Error creating stripe payment:", error);
        // eslint-disable-next-line max-len
        res.status(500).send({error: "Failed to create stripe payment", details: error});
      }
    });

// eslint-disable-next-line max-len
exports.checkPendingTrips = onSchedule("*/15 8-19 * * *",
    async (event) => {
      console.info("Scheduled function executed at:", new Date().toISOString());
      try {
        const db = admin.firestore();
        const queryPendingTrips = db.collection("trips")
            .where("status", "==", "pending")
            // eslint-disable-next-line max-len
            .where("date", "<=", new Date(new Date().getTime() +
                (15 * 60 * 1000)));

        console.info("Execute queryPendingTrips");
        const pendingTripsToProcess = await queryPendingTrips.get();

        for (const trip of pendingTripsToProcess.docs) {
          try {
            await db.collection("trips").doc(trip.id).update({
              "status": "canceled",
              "canceledDate": admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection("trips").doc(trip.id).collection("events").add({
              "action": "canceled",
              "createdBy": "checkPendingTrips",
              "notes": "",
              "reason": "guideUnavailable",
              "creationDate": admin.firestore.FieldValue.serverTimestamp(),
            });
          } catch (error) {
            console.error("Error sending notification", trip, error);
          }
        }
      } catch (error) {
        console.error("Error executing scheduled task:", error);
      }

      return null;
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

        console.info("Execute queryStartTrips");
        const trips = await queryStartTrips.get();

        for (const trip of trips.docs) {
          try {
            const tour = await trip.get("tourId").get();
            await sendGuideTripStartWarning(trip, tour);
            await sendClientTripStartWarning(trip, tour);
          } catch (error) {
            console.error("Error sending notification", trip, error);
          }
        }

        const queryEndTrips = db.collection("trips")
            .where("status", "==", "started")
        // eslint-disable-next-line max-len
            .where("date", ">=", new Date(new Date().getTime() - (4 * 60 * 60 * 1000)))
        // eslint-disable-next-line max-len
            .where("date", "<=", new Date(new Date().getTime() - (2 * 60 * 60 * 1000)));

        console.info("Execute queryEndTrips");
        const endTripsToProcess = await queryEndTrips.get();

        for (const trip of endTripsToProcess.docs) {
          try {
            const tour = await trip.get("tourId").get();
            await sendGuideTripEndWarning(trip, tour);
          } catch (error) {
            console.error("Error sending notification", trip, error);
          }
        }
      } catch (error) {
        console.error("Error executing scheduled task:", error);
      }

      return null;
    });

exports.checkGuideAssociatedTuk = onSchedule("0 1 * * *",
    async (event) => {
      try {
        const db = admin.firestore();
        const queryGuides = db.collection("users")
            .where("guideMode", "==", true)
            .where("accountValidated", "==", true)
            .where("accountAccepted", "==", true)
            .where("disabled", "==", false);

        const guidesToProcess = await queryGuides.get();

        for (const guide of guidesToProcess.docs) {
          await db.collection("users").doc(guide.id).update({
            needSelectTukTuk: true});
        }
      } catch (error) {
        console.error("Error executing scheduled task:", error);
      }
    });

exports.newTripNotification = onDocumentCreated("trips/{docId}",
    async (event) => {
      try {
        const tour = await event.data.get("tourId").get();
        if (event.data.get("status") === "pending") {
          const filteredGuides = await getAvailableGuides(event.data, tour);

          for (const guide of filteredGuides) {
            // eslint-disable-next-line max-len
            await sendGoNowNotification(guide, event.params.docId, event.data, tour);
          }
        }

        if (event.data.get("status") === "booked") {
          const guideRef = event.data.get("guideRef");
          const guide = await guideRef.get();

          if (guide.get("firebaseToken") != null) {
            const tripDate = event.data.get("date").toDate();
            await sendFirebaseNotification("New Tour",
                tripDate.toLocaleString("pt-PT") + " - " + tour.get("name"),
                {"tripId": event.params.docId},
                guide.get("firebaseToken"));
          }
          await createNotificationDocument(guideRef,
              event.data.ref,
              "",
              "trip booked");
        }
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    });

// eslint-disable-next-line max-len
exports.onTripUpdated = onDocumentUpdated("trips/{docId}", async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  const db = admin.firestore();

  if (beforeData.status !== afterData.status) {
    const tour = await event.data.after.get("tourId").get();

    // eslint-disable-next-line max-len
    console.info(`Trip ${event.params.docId} status changed from ${beforeData.status} to ${afterData.status}`);
    if (beforeData.status === "booked" && afterData.status === "rescheduling") {
      const filteredGuides = await getAvailableGuides(event.data.after, tour);
      console.info("Guides available:" + filteredGuides.length);
      const events = await db.collection("trips")
          .doc(event.params.docId)
          .collection("events")
          .where("action", "==", "canceled").get();

      const guideIdWithCancelEvent = [];
      for (const event of events.docs) {
        guideIdWithCancelEvent.push(event.get("createdBy"));
      }
      console.info("Guides with cancel event" + guideIdWithCancelEvent.length);
      const guide = selectGuide(filteredGuides.filter((g) =>
        !guideIdWithCancelEvent.includes(g.id)),
      event.data.after.get("persons"));
      if (guide != null) {
        const db = admin.firestore();

        await db.collection("trips").doc(event.params.docId).update({
          guideRef: guide,
          status: "booked",
        });

        const tripDate = event.data.after.get("date").toDate();
        await updateUserUnavailability(guide.id, tour, tripDate);
      } else {
        console.info("No guide available");
      }
    } else if (beforeData.status === "pending" &&
        afterData.status === "canceled") {
      const clientRef = event.data.after.get("clientRef");

      // eslint-disable-next-line max-len
      await sendClientTripCancelWarning(event.data.after, tour, beforeData.status);
      await createNotificationDocument(clientRef,
          event.data.after.ref,
          "",
          "trip canceled");
    } else if (beforeData.status === "booked" &&
        afterData.status === "canceled") {
      await sendGuideTripCancelWarning(event.data.after, tour);
      await createNotificationDocument(event.data.after.get("guideRef"),
          event.data.after.ref,
          "",
          "trip canceled");


      // eslint-disable-next-line max-len
      await sendClientTripCancelWarning(event.data.after, tour, beforeData.status);
      await createNotificationDocument(event.data.after.get("clientRef"),
          event.data.after.ref,
          "",
          "trip canceled");
    } else if (beforeData.status === "pending" &&
        afterData.status === "booked") {
      // eslint-disable-next-line max-len
      await sendClientTripAcceptedWarning(event.data.after, tour);
      await createNotificationDocument(event.data.after.get("clientRef"),
          event.data.after.ref,
          "",
          "trip accepted");
    } else if (beforeData.status === "booked" &&
        afterData.status === "started") {
      // eslint-disable-next-line max-len
      await sendClientTripStarted(event.data.after, tour);
      await createNotificationDocument(event.data.after.get("clientRef"),
          event.data.after.ref,
          "",
          "trip started");
    } else if (beforeData.status === "started" &&
        afterData.status === "finished") {
      // eslint-disable-next-line max-len
      await sendClientTripStarted(event.data.after, tour);
      await createNotificationDocument(event.data.after.get("clientRef"),
          event.data.after.ref,
          "",
          "trip started");
    }
  }
});

// eslint-disable-next-line max-len
exports.onCreateChatMessage = onDocumentCreated("chat/{chatId}/messages/{messageId}",
    async (event) => {
      const db = admin.firestore();

      const toRef = db.collection("users").doc(event.data.get("to"));
      const fromRef = db.collection("users").doc(event.data.get("from"));
      const tripRef = db.collection("trips").doc(event.params.chatId);

      const to = await toRef.get();
      const from = await fromRef.get();

      if (to.get("firebaseToken") != null) {
        await sendFirebaseNotification(from.get("name"),
            event.data.get("text"),
            {"tripId": event.params.chatId, "type": "message"},
            to.get("firebaseToken"));
      }

      await createNotificationDocument(
          toRef,
          tripRef,
          event.data.get("text"),
          "message");
    });

// eslint-disable-next-line require-jsdoc
async function sendGoNowNotification(guide, tripId, trip, tour) {
  try {
    const tripDate = trip.get("date").toDate();

    const body = tripDate.toLocaleString("pt-PT") + " - " + tour.get("name") +
        "\nEntre na App para aceitar a viagem.";

    await sendFirebaseNotification("Novo Go Now",
        body,
        {"tripId": tripId},
        guide.get("firebaseToken"));

    console.info("Notification sent successfully");
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
    console.error("Error adding document to collection 'notifications'", error);
  }
}

// eslint-disable-next-line require-jsdoc
async function savePaymentData(payment) {
  const db = admin.firestore();

  await db.collection("payments").doc(payment.id).set({
    data: payment,
  });
}
