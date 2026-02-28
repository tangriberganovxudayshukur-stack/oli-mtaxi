let currentTrip = null;
let currentOrder = null;
let lastFinishedTrip = null;
let drivers = [];
let orders = [];

// Boshida importlar
import fs from "fs";
import express from "express";
import cors from "cors";

const app = express();
//app.use(express.static("../frontend"));

app.use(cors());
app.use(express.json()); // JSON body ni o‘qish uchun

// ⚡ BU YERGA SAFAR ENDPOINTLARINI QO‘SHASIZ
app.post("/api/trip", (req, res) => {
  const trip = {
    ...req.body,
    status: "finished",
    endedAt: Date.now()
  };

  // ✅ Faqat tarix uchun faylga yoziladi
  let data = [];
  try {
    data = JSON.parse(fs.readFileSync("trips.json", "utf-8"));
  } catch {}

  data.push(trip);
  fs.writeFileSync("trips.json", JSON.stringify(data, null, 2));

    // 🔥 ORDERNI YAKUNLASH
  if (currentOrder) {
    currentOrder.status = "finished";
    currentOrder.finishedAt = Date.now();
  }	
  // ❗ REAL HOLAT TOZALANADI
  currentTrip = null;
  currentOrder = null;
  

  res.json({ success: true });
});




app.post("/api/order", (req, res) => {
  const { lat, lng } = req.body;

  // faqat online va bo‘sh haydovchilar
  const availableDrivers = drivers.filter(d => d.online && !d.busy);

  if (availableDrivers.length === 0) {
    return res.json({ success: false, error: "Haydovchi topilmadi" });
  }

  // eng yaqinini topamiz
  let nearest = availableDrivers[0];
  let minDist = distance(lat, lng, nearest.lat, nearest.lng);

  for (let d of availableDrivers) {
    const dist = distance(lat, lng, d.lat, d.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = d;
    }
  }

  const order = {
    id: Date.now(),
    lat,
    lng,
    status: "waiting",
    driverId: nearest.id
  };

  orders.push(order);
  currentOrder = order; // 🔥 SHART
  res.json({ success: true });
});




app.get("/api/trips", (req, res) => {
  let data = [];
  try {
    const fileContent = fs.readFileSync("trips.json", "utf-8");
    if (fileContent) {
      data = JSON.parse(fileContent);
    }
  } catch (err) {
    console.log("trips.json bo‘sh yoki topilmadi");
  }
  res.json(data);
});


app.get("/api/trip/current", (req, res) => {
  if (currentTrip) {
    return res.json(currentTrip);
  }
  res.json(null); // ❗ lastFinishedTrip ENDI QAYTMAYDI
});





app.post("/api/register", (req, res) => {
	 console.log("📥 REGISTER:", req.body);
  const { phone, password, role } = req.body;

  if (!phone || !password || !role) {
  return res.json({
    success: false,
    error: "Ma'lumot yetarli emas"
  });
}


  const usersDB = JSON.parse(fs.readFileSync("./users.json"));

  const exists = usersDB.users.find(u => u.phone === phone);
  if (exists) {
   return res.json({
  success: false,
  error: "Bu raqam allaqachon ro‘yxatdan o‘tgan"
});

  }

  const user = {
    id: Date.now(),
    phone,
    password, // hozircha oddiy (keyin shifrlaymiz)
    role,
    createdAt: new Date()
  };

  usersDB.users.push(user);
  fs.writeFileSync("./users.json", JSON.stringify(usersDB, null, 2));

 res.json({
  success: true,
  user: { id: user.id, phone, role }
});

});

app.post("/api/login", (req, res) => {
	 console.log("📥 LOGIN:", req.body);
  const { phone, password } = req.body;

  const usersDB = JSON.parse(fs.readFileSync("./users.json"));

  const user = usersDB.users.find(
    u => u.phone === phone && u.password === password
  );

 if (!user) {
  return res.json({
    success: false,
    error: "Telefon yoki parol xato"
  });
}


  res.json({
    success: true,
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role
    }
  });
});

app.get("/api/order/current/:driverId", (req, res) => {
  const driverId = Number(req.params.driverId);

  const order = orders.find(
    o => o.driverId === driverId && o.status !== "finished"
  );

  res.json(order || null);
});

app.post("/api/trip/start", (req, res) => {
  currentTrip = {
    ...req.body,
    status: "running",
    startedAt: Date.now()
  };

  res.json({ success: true });
});


app.post("/api/trip/update", (req, res) => {
  if (!currentTrip) return res.json({ success: false });

  currentTrip = {
    ...currentTrip,
    ...req.body,
    updatedAt: Date.now()
  };

  res.json({ success: true });
});

app.post("/api/order/accept", (req, res) => {
  if (!currentOrder) {
    return res.json({ success: false });
  }

  currentOrder.status = "accepted";
  currentOrder.acceptedAt = Date.now();

  // ❗ trip bu yerda YO‘Q

  res.json({ success: true });
});



let driverLocation = null;
app.post("/api/driver/location", (req, res) => {
  const { lat, lng, driverId } = req.body;

  let driver = drivers.find(d => d.id === driverId);

  if (!driver) {
    driver = {
      id: driverId,
      lat,
      lng,
      online: true,
      busy: false
    };
    drivers.push(driver);
  } else {
    driver.lat = lat;
    driver.lng = lng;
  }

  res.json({ success: true });
});

app.get("/api/driver/location", (req, res) => {
  res.json(driverLocation);
});

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get("/api/order/passenger/current", (req, res) => {
  const order = orders.find(o => o.status !== "finished");
  res.json(order || null);
});


// Serverni ishga tushirish (Render uchun mos)
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});











