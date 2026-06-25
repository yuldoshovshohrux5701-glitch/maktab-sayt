require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ─── MongoDB ulanish ───────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB ulandi ✓'))
  .catch(err => console.error('MongoDB xatosi:', err));

// ─── Modellar ──────────────────────────────────────────────────────
const YangilikSchema = new mongoose.Schema({
  badge: String,
  badgeType: { type: String, default: 'default' }, // default | green | amber
  sana: String,
  sarlavha: String,
  yaratilgan: { type: Date, default: Date.now }
});

const OqituvchiSchema = new mongoose.Schema({
  init: String,
  avatarRang: { type: String, default: '#E6F1FB' },
  avatarMatn: { type: String, default: '#0C447C' },
  ism: String,
  fan: String,
  bio: String,
  tajriba: String,
  tartib: { type: Number, default: 0 }
});

const AdminSchema = new mongoose.Schema({
  login: { type: String, unique: true },
  parol: String
});

const Yangilik = mongoose.model('Yangilik', YangilikSchema);
const Oqituvchi = mongoose.model('Oqituvchi', OqituvchiSchema);
const Admin = mongoose.model('Admin', AdminSchema);

// ─── Admin yaratish (birinchi ishga tushirishda) ───────────────────
async function adminYarat() {
  const bor = await Admin.findOne({ login: 'admin' });
  if (!bor) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await Admin.create({ login: 'admin', parol: hash });
    console.log('Admin yaratildi: login=admin, parol=' + (process.env.ADMIN_PASSWORD || 'admin123'));
  }
}
adminYarat();

// ─── Token tekshirish middleware ───────────────────────────────────
function tokenTekshir(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ xato: 'Token kerak' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ xato: 'Token yaroqsiz' });
  }
}

// ─── AUTH ──────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { login, parol } = req.body;
  const admin = await Admin.findOne({ login });
  if (!admin) return res.status(401).json({ xato: 'Login yoki parol xato' });
  const togri = await bcrypt.compare(parol, admin.parol);
  if (!togri) return res.status(401).json({ xato: 'Login yoki parol xato' });
  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// ─── YANGILIKLAR (ommaviy) ─────────────────────────────────────────
app.get('/api/yangiliklar', async (req, res) => {
  const list = await Yangilik.find().sort({ yaratilgan: -1 }).limit(12);
  res.json(list);
});

// ─── YANGILIKLAR (admin) ───────────────────────────────────────────
app.post('/api/yangiliklar', tokenTekshir, async (req, res) => {
  const y = await Yangilik.create(req.body);
  res.json(y);
});

app.put('/api/yangiliklar/:id', tokenTekshir, async (req, res) => {
  const y = await Yangilik.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(y);
});

app.delete('/api/yangiliklar/:id', tokenTekshir, async (req, res) => {
  await Yangilik.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ─── O'QITUVCHILAR (ommaviy) ───────────────────────────────────────
app.get('/api/oqituvchilar', async (req, res) => {
  const list = await Oqituvchi.find().sort({ tartib: 1 });
  res.json(list);
});

// ─── O'QITUVCHILAR (admin) ────────────────────────────────────────
app.post('/api/oqituvchilar', tokenTekshir, async (req, res) => {
  const o = await Oqituvchi.create(req.body);
  res.json(o);
});

app.put('/api/oqituvchilar/:id', tokenTekshir, async (req, res) => {
  const o = await Oqituvchi.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(o);
});

app.delete('/api/oqituvchilar/:id', tokenTekshir, async (req, res) => {
  await Oqituvchi.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ─── Parol o'zgartirish ────────────────────────────────────────────
app.put('/api/parol', tokenTekshir, async (req, res) => {
  const { yangiParol } = req.body;
  if (!yangiParol || yangiParol.length < 6)
    return res.status(400).json({ xato: 'Parol kamida 6 ta belgi bo\'lsin' });
  const hash = await bcrypt.hash(yangiParol, 10);
  await Admin.findByIdAndUpdate(req.admin.id, { parol: hash });
  res.json({ ok: true });
});

// ─── Server ishga tushirish ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ishlamoqda: http://localhost:${PORT}`));
