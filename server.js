require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Rasm yoki video kerak'));
  }
});

// IN-MEMORY DATA
const data = {
  admin: { login: 'admin', parol: '' },
  yangiliklar: [],
  oqituvchilar: [],
  hero: { nomi: 'Maktab', tavsifi: 'Sayt', oquvchilar: 1200, oqituvchilar: 68, sinflar: 42, yili: 1975 },
  maktabHaqida: { tarix: '', maqsad: '', yutuqlar: '', moddiyBaza: '', tillar: '', hayot: '' },
  aloqa: { manzil: '', telefon: '', email: '', ishVaqti: '' }
};

// Admin parol o'rnatish
(async () => {
  data.admin.parol = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
  console.log('✓ Admin tayyor: admin / admin123');
})();

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

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { login, parol } = req.body;
    if (login !== data.admin.login) return res.status(401).json({ xato: 'Login yoki parol xato' });
    const togri = await bcrypt.compare(parol, data.admin.parol);
    if (!togri) return res.status(401).json({ xato: 'Login yoki parol xato' });
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (err) {
    res.status(400).json({ xato: err.message });
  }
});

// YANGILIKLAR
app.get('/api/yangiliklar', (req, res) => {
  res.json(data.yangiliklar.sort((a, b) => new Date(b.yaratilgan) - new Date(a.yaratilgan)));
});

app.post('/api/yangiliklar', tokenTekshir, upload.single('rasm'), (req, res) => {
  const y = {
    _id: Date.now().toString(),
    badge: req.body.badge,
    badgeType: req.body.badgeType || 'default',
    sana: req.body.sana,
    sarlavha: req.body.sarlavha,
    tafsil: req.body.tafsil || '',
    rasm: req.file ? `/uploads/${req.file.filename}` : '',
    video: req.body.video || '',
    yaratilgan: new Date()
  };
  data.yangiliklar.push(y);
  res.json(y);
});

app.put('/api/yangiliklar/:id', tokenTekshir, upload.single('rasm'), (req, res) => {
  const idx = data.yangiliklar.findIndex(y => y._id === req.params.id);
  if (idx === -1) return res.status(404).json({ xato: 'Topilmadi' });
  if (req.file) data.yangiliklar[idx].rasm = `/uploads/${req.file.filename}`;
  data.yangiliklar[idx].badge = req.body.badge;
  data.yangiliklar[idx].badgeType = req.body.badgeType;
  data.yangiliklar[idx].sana = req.body.sana;
  data.yangiliklar[idx].sarlavha = req.body.sarlavha;
  data.yangiliklar[idx].tafsil = req.body.tafsil;
  data.yangiliklar[idx].video = req.body.video;
  res.json(data.yangiliklar[idx]);
});

app.delete('/api/yangiliklar/:id', tokenTekshir, (req, res) => {
  data.yangiliklar = data.yangiliklar.filter(y => y._id !== req.params.id);
  res.json({ ok: true });
});

// O'QITUVCHILAR
app.get('/api/oqituvchilar', (req, res) => {
  res.json(data.oqituvchilar.sort((a, b) => a.tartib - b.tartib));
});

app.post('/api/oqituvchilar', tokenTekshir, upload.single('rasm'), (req, res) => {
  const o = {
    _id: Date.now().toString(),
    init: (req.body.init || '').toUpperCase(),
    ism: req.body.ism,
    fan: req.body.fan,
    bio: req.body.bio || '',
    tajriba: req.body.tajriba || '',
    avatarRang: req.body.avatarRang || '#E6F1FB',
    avatarMatn: req.body.avatarMatn || '#0C447C',
    tartib: parseInt(req.body.tartib) || 0,
    rasm: req.file ? `/uploads/${req.file.filename}` : ''
  };
  data.oqituvchilar.push(o);
  res.json(o);
});

app.put('/api/oqituvchilar/:id', tokenTekshir, upload.single('rasm'), (req, res) => {
  const idx = data.oqituvchilar.findIndex(o => o._id === req.params.id);
  if (idx === -1) return res.status(404).json({ xato: 'Topilmadi' });
  if (req.file) data.oqituvchilar[idx].rasm = `/uploads/${req.file.filename}`;
  data.oqituvchilar[idx].init = (req.body.init || '').toUpperCase();
  data.oqituvchilar[idx].ism = req.body.ism;
  data.oqituvchilar[idx].fan = req.body.fan;
  data.oqituvchilar[idx].bio = req.body.bio;
  data.oqituvchilar[idx].tajriba = req.body.tajriba;
  data.oqituvchilar[idx].avatarRang = req.body.avatarRang;
  data.oqituvchilar[idx].avatarMatn = req.body.avatarMatn;
  data.oqituvchilar[idx].tartib = parseInt(req.body.tartib);
  res.json(data.oqituvchilar[idx]);
});

app.delete('/api/oqituvchilar/:id', tokenTekshir, (req, res) => {
  data.oqituvchilar = data.oqituvchilar.filter(o => o._id !== req.params.id);
  res.json({ ok: true });
});

// HERO
app.get('/api/hero', (req, res) => res.json(data.hero));
app.put('/api/hero', tokenTekshir, (req, res) => {
  data.hero = { ...data.hero, ...req.body };
  res.json(data.hero);
});

// MAKTAB HAQIDA
app.get('/api/maktab-haqida', (req, res) => res.json(data.maktabHaqida));
app.put('/api/maktab-haqida', tokenTekshir, (req, res) => {
  data.maktabHaqida = { ...data.maktabHaqida, ...req.body };
  res.json(data.maktabHaqida);
});

// ALOQA
app.get('/api/aloqa', (req, res) => res.json(data.aloqa));
app.put('/api/aloqa', tokenTekshir, (req, res) => {
  data.aloqa = { ...data.aloqa, ...req.body };
  res.json(data.aloqa);
});

// PAROL
app.put('/api/parol', tokenTekshir, async (req, res) => {
  const { yangiParol } = req.body;
  if (!yangiParol || yangiParol.length < 6) return res.status(400).json({ xato: 'Parol 6+ belgi' });
  data.admin.parol = await bcrypt.hash(yangiParol, 10);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✓ Server: http://localhost:${PORT}`));