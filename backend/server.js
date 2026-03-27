let currentTrip = null;
let lastFinishedTrip = null;
let drivers = [];
let orders = [];
let activeTrips = {}; // driverId -> trip object
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
  const { driverId } = req.body;

  // activeTrips dan o‘chirish
  if (driverId && activeTrips[driverId]) {
    delete activeTrips[driverId];
  }

  // qolgan kod (orders ni finished qilish, trips.json ga yozish) — o‘zgarmaydi
  const orderIndex = orders.findIndex(o =>
    o.driverId == driverId && (o.status === "accepted" || o.status === "waiting")
  );
  if (orderIndex !== -1) {
    const finishedOrder = orders[orderIndex];
    finishedOrder.status = "finished";
    finishedOrder.finishedAt = Date.now();
   
  }

  const driver = drivers.find(d => d.id == driverId);
  if (driver) {
    driver.busy = false;
    driver.availableSince = Date.now();
  }

  // trips.json ga saqlash (eski kod)
  const trip = { ...req.body, status: "finished", endedAt: Date.now() };
  try {
    let data = fs.existsSync("trips.json") ? JSON.parse(fs.readFileSync("trips.json", "utf-8")) : [];
    data.push(trip);
    fs.writeFileSync("trips.json", JSON.stringify(data, null, 2));
  } catch (e) {}

  res.json({ success: true, message: "Safar yakunlandi" });
});





// ==================== BUYURTMA YARATISH (ENG MUHIM O‘ZGARISH) ====================
app.post("/api/order", (req, res) => {
  const { lat, lng } = req.body;

  // 🔥 YANGI FILTR — busy bo‘lmagan VA "waiting" buyurtmasi yo‘q haydovchilar
  const eligibleDrivers = drivers.filter(driver => {
    if (driver.busy) return false;

    // Bu haydovchida hali qabul qilinmagan buyurtma bormi?
    const hasWaitingOrder = orders.some(o => 
      o.driverId === driver.id && o.status === "waiting"
    );
    return !hasWaitingOrder;
  });

  if (eligibleDrivers.length === 0) {
    return res.json({ success: false, error: "Hozircha bo‘sh haydovchi yo‘q" });
  }

  // Eng yaqin + eng uzoq vaqtdan beri kutgan haydovchini tanlash
  let minDist = Infinity;
  let bestDriver = null;

  eligibleDrivers.forEach(driver => {
    const d = distance(lat, lng, driver.lat, driver.lng);
    if (d < minDist) {
      minDist = d;
      bestDriver = driver;
    } else if (Math.abs(d - minDist) < 0.05) {
      // Teng masofada — eng uzoq kutganini tanlaymiz (navbat!)
      if (driver.availableSince < bestDriver.availableSince) {
        bestDriver = driver;
      }
    }
  });

  if (!bestDriver) {
    return res.json({ success: false, error: "Mos haydovchi topilmadi" });
  }

  const order = {
    id: Date.now(),
    lat,
    lng,
    driverId: bestDriver.id,
    status: "waiting",
    createdAt: Date.now()
  };

  orders.push(order);
  res.json({ success: true, orderId: order.id });
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



app.post("/api/trip/start", (req, res) => {
  const { driverId, ...tripData } = req.body;
  if (!driverId) return res.json({ success: false, error: "driverId kerak" });

  activeTrips[driverId] = {
    ...tripData,
    status: "running",
    startedAt: Date.now()
  };
  res.json({ success: true });
});



app.post("/api/trip/update", (req, res) => {
  const { driverId, ...tripData } = req.body;
  if (!driverId || !activeTrips[driverId]) {
    return res.json({ success: false });
  }

  activeTrips[driverId] = {
    ...activeTrips[driverId],
    ...tripData,
    updatedAt: Date.now()
  };
  res.json({ success: true });
});

app.get("/api/trip/driver/:driverId", (req, res) => {
  const { driverId } = req.params;
  const trip = activeTrips[driverId];
  res.json(trip || null);
});

app.post("/api/order/accept", (req, res) => {
  const driverId = Number(req.body.driverId); // 🔥 MUHIM

  const order = orders.find(
    o => o.driverId == driverId && o.status === "waiting"
  );

  if (!order) return res.json({ success: false });

  order.status = "accepted";
  const driver = drivers.find(d => d.id === driverId);
if (driver) {
  driver.busy = true;
}
  order.acceptedAt = Date.now();

  res.json({ success: true, orderId: order.id });
});



let driverLocation = null;
app.post("/api/driver/location", (req, res) => {
  const { driverId, lat, lng } = req.body;
  let driver = drivers.find(d => d.id === driverId);

  if (!driver) {
    driver = {
      id: driverId,
      lat,
      lng,
      online: true,
      updatedAt: Date.now(),
      availableSince: Date.now(),   // 🔥 YANGI
      busy: false                   // 🔥 YANGI
    };
    drivers.push(driver);
  } else {
    driver.lat = lat;
    driver.lng = lng;
    driver.updatedAt = Date.now();
    // availableSince faqat bo‘sh bo‘lganda yangilanadi (quyida)
  }
  res.json({ success: true });
});
// Yo'lovchi o'z haydovchisini ko'rishi uchun yangi endpoint
app.get("/api/driver/location/:driverId", (req, res) => {
  const { driverId } = req.params;
  const driver = drivers.find(d => d.id == driverId);
  res.json(driver || null);
});


function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) *
    Math.cos(lat2*Math.PI/180) *
    Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}


app.get("/api/order/driver/:driverId", (req, res) => {
  const { driverId } = req.params;

  // Ham 'waiting' (yangi), ham 'accepted' (qabul qilingan) buyurtmalarni qaytaramiz
  const order = orders.find(
    o => o.driverId == driverId && 
    (o.status === "waiting" || o.status === "accepted")
  );

  res.json(order || null);
});


app.get("/api/order/passenger/:orderId", (req, res) => {
  const { orderId } = req.params;

  const order = orders.find(o => o.id == orderId);
  res.json(order || null);
});
// ==================== LINYA BOSHQARISH ====================
app.post("/api/driver/online", (req, res) => {
  const { driverId } = req.body;
  const driver = drivers.find(d => d.id == driverId);
  if (driver) {
    driver.busy = false;
    driver.availableSince = Date.now(); // 🔥 navbat oxiriga tushadi
    console.log(`✅ Haydovchi ${driverId} linyaga chiqdi → busy=false`);
  }
  res.json({ success: true });
});

app.post("/api/driver/offline", (req, res) => {
  const { driverId } = req.body;
  const driver = drivers.find(d => d.id == driverId);
  if (driver) {
    driver.busy = true;
    console.log(`🔴 Haydovchi ${driverId} linyadan chiqdi → busy=true`);
  }
  res.json({ success: true });
});

app.post("/api/order/cancel", (req, res) => {
  const { orderId } = req.body;
  const order = orders.find(o => o.id == orderId);
  if (order) {
    const driver = drivers.find(d => d.id == order.driverId);
    if (driver) driver.busy = false;
    orders = orders.filter(o => o.id != orderId);
  }
  res.json({ success: true });
});

// Serverni ishga tushirish (Render uchun mos)
const PORT = process.env.PORT || 3000;

// 🔥 XAVFSIZ TOZALASH — yo‘lovchi 100% ko‘rib ulguradi
setInterval(() => {
  const minKeepTime = Date.now() - 60 * 1000; // 1 daqiqa oldin

  orders = orders.filter(order => {
    // Faqat "finished" bo‘lganlarni tekshiramiz
    if (order.status !== "finished") return true;           // active buyurtmalarni saqlaymiz
    if (!order.finishedAt) return true;                     // eski buyurtmalar
    return order.finishedAt > minKeepTime;                  // 1 daqiqadan yangi bo‘lsa — saqlaymiz
  });

  console.log(`🧹 Tozalash bajarildi. Qolgan buyurtmalar: ${orders.length}`);
}, 5 * 60 * 1000); // har 5 daqiqada

// ==================== BUYURTMA TIMEOUT + REASSIGN ======================
// (BU YERNI TO‘LIQ ALMASHTIRING — faqat reassignOrder o‘zgardi)

const ORDER_TIMEOUT_MS = 15000; // 15 sekund (o‘zingiz o‘zgartirishingiz mumkin)

function reassignOrder(order) {
  const oldDriverId = order.driverId;
  const oldDriver = drivers.find(d => d.id === oldDriverId);

  if (oldDriver) {
    // 🔥 ASOSIY O‘ZGARISH: Haydovchini LINYADAN CHIQArib yuboramiz!
    oldDriver.busy = true;                    // endi buyurtma ololmaydi
    // availableSince ni yangilamaymiz — chunki u offline holatda
    console.log(`🚫 TIMEOUT! Driver ${oldDriverId} buyurtma ${order.id} ni qabul qilmadi → AVTO OFFLINE (busy=true)`);
  }

  // Eski haydovchini bu buyurtma uchun ban qilamiz (oldingi kod)
  order.driverId = null;

  const eligibleDrivers = drivers.filter(driver => {
    if (driver.busy || driver.id === oldDriverId) return false;
    const hasWaiting = orders.some(o =>
      o.id !== order.id && o.driverId === driver.id && o.status === "waiting"
    );
    return !hasWaiting;
  });

  if (eligibleDrivers.length === 0) {
    console.log(`❌ Buyurtma ${order.id} uchun boshqa haydovchi topilmadi`);
    return;
  }

  let minDist = Infinity;
  let bestDriver = null;
  eligibleDrivers.forEach(driver => {
    const d = distance(order.lat, order.lng, driver.lat, driver.lng);
    if (d < minDist ||
       (Math.abs(d - minDist) < 0.05 && driver.availableSince < (bestDriver?.availableSince || Infinity))) {
      minDist = d;
      bestDriver = driver;
    }
  });

  if (bestDriver) {
    order.driverId = bestDriver.id;
    console.log(`✅ Buyurtma ${order.id} → yangi haydovchi ${bestDriver.id} ga o‘tkazildi`);
  }
}

// Har 10 sekundda tekshirish (bu qism o‘zgarmasin)
setInterval(() => {
  const now = Date.now();
  for (let i = orders.length - 1; i >= 0; i--) {
    const order = orders[i];
    if (order.status === "waiting" && now - order.createdAt > ORDER_TIMEOUT_MS) {
      reassignOrder(order);
    }
  }
}, 10000);

console.log("🛡️ Order timeout tizimi yoqildi (15 sekund + avto offline)");

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
