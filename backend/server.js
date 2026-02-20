let currentTrip = null;
let currentOrder = null;
let lastFinishedTrip = null;


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

  // ❗ REAL HOLAT TOZALANADI
  currentTrip = null;
  currentOrder = null;
  lastFinishedTrip = null; // 🔥 ENG MUHIM

  res.json({ success: true });
});





app.post("/api/order", (req, res) => {
  currentOrder = {
    ...req.body,
    id: Date.now(),
    status: "waiting"
  };

  console.log("🧍 Yangi buyurtma:", currentOrder);

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

app.get("/api/order/current", (req, res) => {
  res.json(currentOrder);
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
  driverLocation = {
    lat: req.body.lat,
    lng: req.body.lng,
    updatedAt: Date.now()
  };
  res.json({ success: true });
});
app.get("/api/driver/location", (req, res) => {
  res.json(driverLocation);
});


app.get("/users", ...)


// Serverni ishga tushirish (Render uchun mos)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});


