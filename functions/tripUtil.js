const {sendFirebaseNotification} = require("./firebaseUtil");

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

exports.sendGuideTripStartWarning = sendGuideTripStartWarning;
exports.sendClientTripStartWarning = sendClientTripStartWarning;
exports.sendGuideTripEndWarning = sendGuideTripEndWarning;
