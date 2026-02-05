const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// temporary bus location
let busLocation = {
  lat: 12.8700,
  lng: 74.8800,
  lastUpdate: null,
};

// API: update bus location
app.post("/update-location", (req, res) => {
  const { lat, lng } = req.body;

  busLocation = {
    lat: lat,
    lng: lng,
    lastUpdate: new Date(),
  };

  console.log("Bus location updated:", busLocation);

  res.send({ status: "ok" });
});

// API: get bus location
app.get("/bus-location", (req, res) => {
  res.send(busLocation);
});

// start server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
