import { useState, useEffect } from "react";
import routesData from "./routes.json";
import "./App.css";

const SERVER = import.meta.env.VITE_SERVER_URL;

const allStops = [
  ...new Set(routesData.routes.flatMap(r => r.stops.map(s => s.name)))
];

function parseTime(t) {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0);
  return d;
}

function getStatus(bus) {
  const now = new Date();
  const start = parseTime(bus.startTime);
  const end = parseTime(bus.endTime);

  if (now < start) return "Yet to start";
  if (now > end) return "Completed";
  return "Running";
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPredictedLocation(bus) {
  const now = new Date();

  for (let i = 0; i < bus.stops.length - 1; i++) {
    const a = bus.stops[i];
    const b = bus.stops[i + 1];

    const t1 = parseTime(a.time);
    const t2 = parseTime(b.time);

    if (now >= t1 && now <= t2) {
      return {
        lat: (a.lat + b.lat) / 2,
        lng: (a.lng + b.lng) / 2
      };
    }
  }

  return {
    lat: bus.stops[0].lat,
    lng: bus.stops[0].lng
  };
}

export default function App() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [mapView, setMapView] = useState(false);
  const [userLoc, setUserLoc] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [busLocation, setBusLocation] = useState(null);
  const [nearStop, setNearStop] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [userId] = useState(() =>
    Math.random().toString(36).slice(2)
  );

  useEffect(() => {
    navigator.geolocation.watchPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const spd = pos.coords.speed ? pos.coords.speed * 3.6 : 0;

      setUserLoc({ lat, lng });
      setSpeed(spd);

      fetch(`${SERVER}/update-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          lat,
          lng,
          speed: spd,
          heading: pos.coords.heading || 0
        })
      });
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!selectedBus) return;
      const res = await fetch(`${SERVER}/bus-location`);
      const data = await res.json();
      setBusLocation(data);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedBus]);

  useEffect(() => {
    if (!selectedBus || !userLoc) return;

    let near = false;

    for (let stop of selectedBus.stops) {
      const d = distanceMeters(
        userLoc.lat,
        userLoc.lng,
        stop.lat,
        stop.lng
      );

      const now = new Date();
      const stopTime = parseTime(stop.time);
      const diffMin = (now - stopTime) / 60000;

      if (d < 50 && diffMin > -3 && diffMin < 5) {
        near = true;
      }
    }

    setNearStop(near);
  }, [userLoc, selectedBus]);

  useEffect(() => {
    if (speed > 25 && !confirmed) {
      fetch(`${SERVER}/confirm-inside`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      setConfirmed(true);
    }
  }, [speed]);

  const handleSearch = () => {
    const fromStop = allStops.find(s =>
      s.toLowerCase().includes(from.toLowerCase())
    );
    const toStop = allStops.find(s =>
      s.toLowerCase().includes(to.toLowerCase())
    );

    if (!fromStop || !toStop) {
      alert("Stop not listed");
      return;
    }

    const buses = routesData.routes.filter(bus => {
      const names = bus.stops.map(s => s.name);
      return (
        names.indexOf(fromStop) !== -1 &&
        names.indexOf(toStop) !== -1 &&
        names.indexOf(fromStop) < names.indexOf(toStop)
      );
    });

    setResults(buses);
  };

  // MAP VIEW
  if (selectedBus && mapView) {
    const now = new Date();
    const start = parseTime(selectedBus.startTime);

    let loc = null;
    if (now >= start) {
      loc =
        busLocation?.mode === "live"
          ? busLocation
          : getPredictedLocation(selectedBus);
    }

    if (!loc) {
      return (
        <div className="app">
          <div className="topbar">Bus Map</div>
          <div className="bottom-message">
            Bus yet to start. Map will be available after departure.
          </div>
          <button className="back" onClick={() => setMapView(false)}>
            Back
          </button>
        </div>
      );
    }

    const mapUrl = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

    return (
      <div className="app">
        <div className="topbar">Bus Map</div>

        <iframe
          title="map"
          width="100%"
          height="400"
          src={`https://maps.google.com/maps?q=${loc.lat},${loc.lng}&z=14&output=embed`}
        />

        <button className="green" onClick={() => window.open(mapUrl, "_blank")}>
          Open in Google Maps
        </button>

        <button className="back" onClick={() => setMapView(false)}>
          Back
        </button>
      </div>
    );
  }

  // BUS DETAIL SCREEN (UNCHANGED FROM YOUR LOGIC)
  // 🔒 everything else stays exactly the same

  // BUS DETAIL SCREEN
  if (selectedBus) {
    const status = getStatus(selectedBus);
    const now = new Date();
    const start = parseTime(selectedBus.startTime);

    const loc =
      busLocation?.mode === "live"
        ? busLocation
        : getPredictedLocation(selectedBus);

    let currentIndex = 0;
    let distanceToNext = 0;

    if (loc) {
      let minDist = Infinity;

      selectedBus.stops.forEach((stop, i) => {
        const d = distanceMeters(
          loc.lat,
          loc.lng,
          stop.lat,
          stop.lng
        );

        if (d < minDist) {
          minDist = d;
          currentIndex = i;
        }
      });

      if (currentIndex < selectedBus.stops.length - 1) {
        const next = selectedBus.stops[currentIndex + 1];
        distanceToNext = distanceMeters(
          loc.lat,
          loc.lng,
          next.lat,
          next.lng
        );
      }
    }

    const km = Math.max(0, Math.round(distanceToNext / 1000));

    let message = "";

    if (now < start) {
      const firstStop = selectedBus.stops[0];
      message = `Bus yet to start. Starts from ${firstStop.name} at ${selectedBus.startTime}.`;
    } else if (currentIndex < selectedBus.stops.length - 1) {
      const currentStop = selectedBus.stops[currentIndex];
      const nextStop = selectedBus.stops[currentIndex + 1];

      if (km <= 1) {
        message = `Stop in 3 minutes (${km} km). Get ready.`;
      } else {
        if (busLocation?.mode === "live") {
          message = `Left ${currentStop.name}. ${km} km to ${nextStop.name}.`;
        } else {
          message = `Hopefully bus is near ${currentStop.name}. ${km} km to ${nextStop.name}.`;
        }
      }
    }

    return (
      <div className="app">
        <div className="topbar">{selectedBus.busName}</div>

        <div className="status">
          <span>Status: {status}</span>
          <span>Mode: {busLocation?.mode || "predicted"}</span>
        </div>

        {nearStop && !confirmed && (
          <div className="popup">
            <p>Are you inside the bus?</p>
            <button
              className="green"
              onClick={() => {
                fetch(`${SERVER}/confirm-inside`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId })
                });
                setConfirmed(true);
              }}
            >
              Yes
            </button>
          </div>
        )}

        <button
          className="green"
          onClick={() => setMapView(true)}
        >
          View Map
        </button>

        <div className="timeline">
          {selectedBus.stops.map((s, i) => {
            let state = "upcoming";
            if (i < currentIndex) state = "passed";
            if (i === currentIndex) state = "current";

            return (
              <div key={i} className={`timeline-row ${state}`}>
                <div className="dot" />
                <div>
                  <div className="stop-name">{s.name}</div>
                  <div className="stop-time">{s.time}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bottom-message">{message}</div>

        <button className="back" onClick={() => setSelectedBus(null)}>
          Back
        </button>
      </div>
    );
  }

  // SEARCH SCREEN
  return (
    <div className="app">
      <div className="topbar">Where is my Bus</div>

      <div className="search-box">
        <input
          placeholder="From"
          value={from}
          onChange={e => {
            setFrom(e.target.value);
            setSuggestions(
              allStops.filter(s =>
                s.toLowerCase().includes(e.target.value.toLowerCase())
              )
            );
          }}
        />

        <input
          placeholder="To"
          value={to}
          onChange={e => {
            setTo(e.target.value);
            setSuggestions(
              allStops.filter(s =>
                s.toLowerCase().includes(e.target.value.toLowerCase())
              )
            );
          }}
        />

        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map(s => (
              <div
                key={s}
                onClick={() => {
                  if (!from) setFrom(s);
                  else setTo(s);
                  setSuggestions([]);
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}

        <button className="green" onClick={handleSearch}>
          Find Buses
        </button>
      </div>

      <div className="bus-list">
        {results.length === 0 && from && to && (
          <div className="no-result">No bus found</div>
        )}

        {results.map(bus => (
          <div
            key={bus.id}
            className="bus-card"
            onClick={() => setSelectedBus(bus)}
          >
            <div>{bus.busName}</div>
            <div>{bus.startTime} → {bus.endTime}</div>
            <div>{getStatus(bus)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
