const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

let users = {};
let busLocation = {
  lat: 12.87,
  lng: 74.88,
  mode: "predicted"
};

// update user location
app.post("/update-user", (req, res) => {
  const { userId, lat, lng, speed } = req.body;

  users[userId] = {
    lat,
    lng,
    speed,
    lastUpdate: Date.now()
  };

  // choose fastest user as tracker
  let bestUser = null;
  let bestSpeed = 0;

  for (let id in users) {
    if (users[id].speed > bestSpeed) {
      bestSpeed = users[id].speed;
      bestUser = users[id];
    }
  }

  if (bestUser && bestSpeed > 10) {
    busLocation = {
      lat: bestUser.lat,
      lng: bestUser.lng,
      mode: "live"
    };
  }

  res.send({ status: "ok" });
});

// confirm inside bus
app.post("/confirm-inside", (req, res) => {
  const { userId } = req.body;

  if (users[userId]) {
    busLocation = {
      lat: users[userId].lat,
      lng: users[userId].lng,
      mode: "live"
    };
  }

  res.send({ status: "confirmed" });
});

// get bus location
app.get("/bus-location", (req, res) => {
  res.send(busLocation);
});

// test route
app.get("/", (req, res) => {
  res.send("Bus Tracker API running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
