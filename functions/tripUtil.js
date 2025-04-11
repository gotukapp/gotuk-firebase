const {sendFirebaseNotification} = require("./firebaseUtil");
const admin = require("firebase-admin");

// eslint-disable-next-line require-jsdoc
async function sendClientTripCancelWarning(trip, tour, previousStatus) {
  const tourName = tour.get("name");
  const client = await trip.get("clientRef").get();
  const tripDate = trip.get("date").toDate();
  const tripTime = tripDate.toLocaleTimeString("pt-PT",
      {hour: "2-digit", minute: "2-digit"});

  const title = "Tour cancelado!";

  const body = previousStatus === "pending" ? tourName +
      // eslint-disable-next-line max-len
      "\nNão foi possível encontrar um guia para a sua reserva das " + tripTime + "!" :
      tourName +
      // eslint-disable-next-line max-len
      "\nA sua reserva "+ await trip.get("reservationId") + " das " + tripTime + " foi cancelada!";

  if (client.exists) {
    const documentData = client.data();
    const hasField = "firebaseToken" in documentData;
    if (hasField) {
      // eslint-disable-next-line max-len
      await sendFirebaseNotification(title, body, {"tripId": trip.id}, client.get("firebaseToken"));
    }
  }
}

// eslint-disable-next-line require-jsdoc
async function sendClientTripStartWarning(trip, tour) {
  const tourName = tour.get("name");
  const client = await trip.get("clientRef").get();
  const tripDate = trip.get("date").toDate();
  const tripTime = tripDate.toLocaleTimeString("pt-PT",
      {hour: "2-digit", minute: "2-digit"});

  const title = new Date().getTime() < tripDate.getTime() ?
      "O seu tour começa em breve!" :
      "Tem um tour por iniciar!";

  const body = tourName +
      "\n" + (new Date().getTime() < tripDate.getTime() ?
          "Não perca: o seu tour começa às " + tripTime + "!" :
          "Urgente: o seu tour deveria ter iniciado às " + tripTime + "!");

  if (client.exists) {
    const documentData = client.data();
    const hasField = "firebaseToken" in documentData;
    if (hasField) {
      // eslint-disable-next-line max-len
      await sendFirebaseNotification(title, body, {"tripId": trip.id}, client.get("firebaseToken"));
    }
  }
}

// eslint-disable-next-line require-jsdoc
async function sendClientTripStarted(trip, tour) {
  const tourName = tour.get("name");
  const reservationId = tour.get("reservationId");
  const client = await trip.get("clientRef").get();
  const tripDate = trip.get("date").toDate();
  const tripTime = tripDate.toLocaleTimeString("pt-PT",
      {hour: "2-digit", minute: "2-digit"});

  const title = "Tour iniciado!";

  const body = tourName +
      "\nO Tour " + reservationId + " das " + tripTime + " foi iniciado!";


  if (client.exists) {
    const documentData = client.data();
    const hasField = "firebaseToken" in documentData;
    if (hasField) {
      // eslint-disable-next-line max-len
      await sendFirebaseNotification(title, body, {"tripId": trip.id}, client.get("firebaseToken"));
    }
  }
}

// eslint-disable-next-line require-jsdoc
async function sendClientTripAcceptedWarning(trip, tour) {
  const tourName = tour.get("name");
  const reservationId = tour.get("reservationId");
  const client = await trip.get("clientRef").get();
  const tripDate = trip.get("date").toDate();
  const tripTime = tripDate.toLocaleTimeString("pt-PT",
      {hour: "2-digit", minute: "2-digit"});

  const title = "Tour Confirmado!";

  const body = tourName +
      "\nO Tour " + reservationId + " das " + tripTime + " está confirmado!";

  if (client.exists) {
    const documentData = client.data();
    const hasField = "firebaseToken" in documentData;
    if (hasField) {
      // eslint-disable-next-line max-len
      await sendFirebaseNotification(title, body, {"tripId": trip.id}, client.get("firebaseToken"));
    }
  }
}

// eslint-disable-next-line require-jsdoc
async function sendGuideTripCancelWarning(trip, tour) {
  const tourName = tour.get("name");
  const guide = await trip.get("guideRef").get();
  const tripDate = trip.get("date").toDate();
  const tripTime = tripDate.toLocaleTimeString("pt-PT",
      {hour: "2-digit", minute: "2-digit"});

  const title = "Tour cancelado!";

  const body = tourName +
      // eslint-disable-next-line max-len
      "\nO Tour "+ await trip.get("reservationId") + " das " + tripTime + " foi cancelado!";

  if (guide.exists) {
    const documentData = guide.data();
    const hasField = "firebaseToken" in documentData;
    if (hasField) {
      // eslint-disable-next-line max-len
      await sendFirebaseNotification(title, body, {"tripId": trip.id}, guide.get("firebaseToken"));
    }
  }
}

// eslint-disable-next-line require-jsdoc
async function sendGuideTripStartWarning(trip, tour) {
  const tourName = tour.get("name");
  const guide = await trip.get("guideRef").get();
  const tripDate = trip.get("date").toDate();
  const tripTime = tripDate.toLocaleTimeString("pt-PT",
      {hour: "2-digit", minute: "2-digit"});

  const title = new Date().getTime() < tripDate.getTime() ?
        "Próximo tour começa em breve!" :
        "Tem um tour por iniciar!";

  const body = tourName +
        "\n" + (new Date().getTime() < tripDate.getTime() ?
            "Prepare-se: você tem um tour às " + tripTime + "!" :
            "Atenção: este tour já devia ter iniciado às " + tripTime + "!");

  if (guide.exists) {
    const documentData = guide.data();
    const hasField = "firebaseToken" in documentData;
    if (hasField) {
      // eslint-disable-next-line max-len
      await sendFirebaseNotification(title, body, {"tripId": trip.id}, guide.get("firebaseToken"));
    }
  }
}

// eslint-disable-next-line require-jsdoc
async function sendGuideTripEndWarning(trip, tour) {
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
      await sendFirebaseNotification(title, body, {"tripId": trip.id}, guide.get("firebaseToken"));
    }
  }
}

// eslint-disable-next-line require-jsdoc
function selectGuide(filteredGuides, seats) {
  if (!filteredGuides ||
      !Array.isArray(filteredGuides) ||
      filteredGuides.length === 0) {
    return null;
  }

  // eslint-disable-next-line max-len
  let topGuides = filteredGuides.length > 5 ? filteredGuides.slice(0, 5) : filteredGuides;

  if (seats === 4) {
    // Filter guides that have tuktuks with exactly 4 seats
    // eslint-disable-next-line max-len
    const guidesWith4Seats = filteredGuides.filter((guide) => guide.tuktukSeats === 4);
    if (guidesWith4Seats.length > 0) {
      // eslint-disable-next-line max-len
      topGuides = filteredGuides.length > 5 ? filteredGuides.slice(0, 5) : filteredGuides;
    }
  }

  // Generate weights dynamically (higher index = lower weight)
  const weights = topGuides.map((_, index) => topGuides.length - index);

  // Select a guide based on weighted probability
  return weightedRandomSelection(topGuides, weights);
}

// Weighted random selection logic
// eslint-disable-next-line require-jsdoc
function weightedRandomSelection(items, weights) {
  if (items.length !== weights.length || items.length === 0) {
    throw new Error("Items and weights must have the same non-zero length.");
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const randomNumber = Math.floor(Math.random() * totalWeight);

  let cumulativeWeight = 0;
  for (let i = 0; i < items.length; i++) {
    cumulativeWeight += weights[i];
    if (randomNumber < cumulativeWeight) {
      return items[i];
    }
  }

  throw new Error("No item selected. Check the weights and logic.");
}

const AVAILABLE_STATUS = 1;
const UNAVAILABLE_STATUS = 0;

// eslint-disable-next-line max-len,require-jsdoc
async function updateUserUnavailability(guideId, tour, tripDate) {
  for (let i = 0; i < tour.durationSlots; i++) {
    // Calculate total minutes from the starting point
    const totalMinutes = (tripDate.getHours() * 60) +
        tripDate.getMinutes() + (i * 30);
    // eslint-disable-next-line max-len
    const newHour = Math.floor(totalMinutes / 60); // Integer division to get hours
    const newMinutes = totalMinutes % 60; // Remainder to get minutes

    // eslint-disable-next-line max-len
    const hour = `${String(newHour).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
    const formatter = new Intl.DateTimeFormat("pt-PT",
        {year: "numeric", month: "2-digit", day: "2-digit"});
    const date = formatter.format(tripDate);

    await updateUserCollection(guideId, date, hour, UNAVAILABLE_STATUS);
    await updateUnavailabilityCollection(guideId,
        date,
        hour,
        UNAVAILABLE_STATUS);
  }
}

// Updates the user's availability in their Firestore document
// eslint-disable-next-line require-jsdoc
async function updateUserCollection(userId, day, hour, status) {
  const db = admin.firestore();
  const userUnavailabilityRef = db.collection("users")
      .doc(userId).collection("unavailability").doc(day);

  const doc = await userUnavailabilityRef.get();
  let slots = doc.exists ? doc.data().slots || [] : [];

  if (status === AVAILABLE_STATUS) {
    slots = slots.filter((slot) => slot !== hour); // Remove if available
  } else {
    if (!slots.includes(hour)) slots.push(hour); // Add if unavailable
  }

  await userUnavailabilityRef.set({
    date: new Date(day),
    slots: slots,
  }, {merge: true});
}

// Updates the global unavailability collection
// eslint-disable-next-line require-jsdoc
async function updateUnavailabilityCollection(guideId, day, hour, status) {
  const db = admin.firestore();
  const unavailabilityRef = db.collection("unavailability").doc(day);

  const doc = await unavailabilityRef.get();
  let guides = doc.exists && doc.data()[hour] ? doc.data()[hour] : [];

  if (status === AVAILABLE_STATUS) {
    guides = guides.filter((g) => g !== guideId);
  } else {
    if (!guides.includes(guideId)) guides.push(guideId);
  }

  await unavailabilityRef.set({
    [hour]: guides,
  }, {merge: true});
}


exports.sendGuideTripStartWarning = sendGuideTripStartWarning;
exports.sendClientTripStartWarning = sendClientTripStartWarning;
exports.sendClientTripCancelWarning = sendClientTripCancelWarning;
exports.sendClientTripAcceptedWarning = sendClientTripAcceptedWarning;
exports.sendClientTripStarted = sendClientTripStarted;
exports.sendGuideTripCancelWarning = sendGuideTripCancelWarning;
exports.sendGuideTripEndWarning = sendGuideTripEndWarning;
exports.selectGuide = selectGuide;
exports.updateUserUnavailability = updateUserUnavailability;
