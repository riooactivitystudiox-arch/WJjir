const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { Server } = require('socket.io');
const { Member, Post, Memory, Message, initDb } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const ROOT = path.join(__dirname, '..');

// Pakai folder uploads di root (aman di Railway)
const uploadDir = path.join(ROOT, 'uploads');
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {
  console.warn('Upload dir warning:', e.message);
}

const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;

const sessionMiddleware = session({
  store: MongoStore.create({
    mongoUrl: mongoUri,
    ttl: 60 * 60 * 24 * 7,
    collectionName: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'dev-only-change-me-walijomok',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/images', express.static(path.join(ROOT, 'images')));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(ROOT, { index: false, extensions: ['html'] }));

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype))
});

function isStaff(role) {
  return role === 'Admin' || role === 'Creator';
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Login diperlukan.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Login diperlukan.' });
  if (!isStaff(req.session.user.role)) return res.status(403).json({ error: 'Khusus Admin / Creator.' });
  next();
}

function cleanMember(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    username: doc.username,
    display_name: doc.display_name,
    role: doc.role,
    verified: doc.verified,
    avatar: doc.avatar,
    bio: doc.bio || '',
    active: doc.active
  };
}

const protectedPages = new Set([
  '/home.html', '/page/community.html', '/page/memories.html', '/page/links.html',
  '/page/chat.html', '/post/jawajir.html', '/admin.html', '/profile.html'
]);

app.get('*', (req, res, next) => {
  if (protectedPages.has(req.path) || /^\/member\/.+\.html$/.test(req.path)) {
    if (!req.session.user) return res.redirect('/login.html');
  }
  next();
});

app.get('/', (req, res) => res.redirect(req.session.user ? '/home.html' : '/login.html'));
app.get('/api/me', (req, res) => res.json({ user: req.session.user || null }));

app.get('/api/members-public', async (req, res) => {
  try {
    const members = await Member.find({ active: true }).select('username display_name').sort({ created_at: 1 }).lean();
    res.json(members);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal mengambil data member.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nama dan password wajib diisi.' });

    const member = await Member.findOne({ username: String(username).trim().toLowerCase(), active: true });
    if (!member || !(await bcrypt.compare(password, member.password_hash))) {
      return res.status(401).json({ error: 'Nama member atau password salah.' });
    }

    req.session.user = cleanMember(member);
    res.json({ user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal login.' });
  }
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/members', requireAuth, async (req, res) => {
  try {
    const members = await Member.find().select('username display_name role verified avatar bio active').sort({ created_at: 1 }).lean();
    res.json(members.map(m => ({
      id: m._id.toString(),
      username: m.username,
      display_name: m.display_name,
      role: m.role,
      verified: m.verified,
      avatar: m.avatar,
      bio: m.bio || '',
      active: m.active
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal mengambil member.' });
  }
});

app.post('/api/members', requireAdmin, async (req, res) => {
  try {
    const { username, display_name, role = 'Member', password = '111wj', verified = false, bio = '' } = req.body;
    if (!username?.trim() || !display_name?.trim()) {
      return res.status(400).json({ error: 'Username dan display name wajib.' });
    }
    const uname = username.trim().toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z0-9_]+$/.test(uname)) {
      return res.status(400).json({ error: 'Username hanya huruf kecil, angka, underscore.' });
    }
    const exists = await Member.findOne({ username: uname });
    if (exists) return res.status(400).json({ error: 'Username sudah dipakai.' });

    const allowedRoles = ['Member', 'Admin', 'Creator'];
    const finalRole = allowedRoles.includes(role) ? role : 'Member';
    if (finalRole === 'Creator' && req.session.user.role !== 'Creator') {
      return res.status(403).json({ error: 'Hanya Creator yang bisa menambah Creator.' });
    }

    const hash = await bcrypt.hash(String(password || '111wj'), 12);
    const member = await Member.create({
      username: uname,
      display_name: display_name.trim(),
      role: finalRole,
      verified: !!verified,
      bio: bio || '',
      password_hash: hash,
      active: true
    });
    res.json(cleanMember(member));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal menambah member.' });
  }
});

app.patch('/api/members/:id', requireAdmin, async (req, res) => {
  try {
    const { role, active, verified, display_name, bio } = req.body;
    const target = await Member.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Member tidak ditemukan.' });

    if (target.role === 'Creator' && req.session.user.role !== 'Creator') {
      return res.status(403).json({ error: 'Tidak bisa mengedit Creator.' });
    }
    if (role === 'Creator' && req.session.user.role !== 'Creator') {
      return res.status(403).json({ error: 'Hanya Creator yang bisa set role Creator.' });
    }

    const update = {};
    if (role !== undefined) update.role = role;
    if (active !== undefined) update.active = active;
    if (verified !== undefined) update.verified = verified;
    if (display_name !== undefined) update.display_name = display_name;
    if (bio !== undefined) update.bio = bio;

    const member = await Member.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(cleanMember(member));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal update member.' });
  }
});

app.delete('/api/members/:id', requireAdmin, async (req, res) => {
  try {
    const target = await Member.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Member tidak ditemukan.' });
    if (target.role === 'Creator') return res.status(403).json({ error: 'Creator tidak bisa dihapus.' });
    if (target._id.toString() === req.session.user.id) {
      return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' });
    }
    await Member.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal hapus member.' });
  }
});

app.post('/api/members/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const password = String(req.body.password || '111wj');
    if (password.length < 4) return res.status(400).json({ error: 'Password minimal 4 karakter.' });
    const hash = await bcrypt.hash(password, 12);
    await Member.findByIdAndUpdate(req.params.id, { password_hash: hash });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal reset password.' });
  }
});

app.patch('/api/profile', requireAuth, async (req, res) => {
  try {
    const { display_name, bio, avatar } = req.body;
    const update = {};
    if (display_name !== undefined && String(display_name).trim()) update.display_name = String(display_name).trim();
    if (bio !== undefined) update.bio = String(bio).slice(0, 500);
    if (avatar !== undefined) update.avatar = avatar;

    const member = await Member.findByIdAndUpdate(req.session.user.id, update, { new: true });
    req.session.user = cleanMember(member);
    res.json({ user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal update profile.' });
  }
});

app.post('/api/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File avatar wajib.' });
    const avatarUrl = `/uploads/${req.file.filename}`;
    const member = await Member.findByIdAndUpdate(req.session.user.id, { avatar: avatarUrl }, { new: true });
    req.session.user = cleanMember(member);
    res.json({ user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal upload avatar.' });
  }
});

app.get('/api/posts', requireAuth, async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'username display_name role avatar verified').sort({ created_at: -1 }).limit(100).lean();
    res.json(posts.map(p => ({
      id: p._id.toString(),
      content: p.content,
      image_url: p.image_url || '',
      created_at: p.created_at,
      author_id: p.author?._id?.toString(),
      username: p.author?.username,
      display_name: p.author?.display_name,
      role: p.author?.role,
      avatar: p.author?.avatar,
      verified: p.author?.verified
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal mengambil posts.' });
  }
});

app.get('/api/memories', requireAuth, async (req, res) => {
  try {
    const memories = await Memory.find().populate('created_by', 'display_name').sort({ created_at: -1 }).limit(200).lean();
    res.json(memories.map(m => ({
      id: m._id.toString(),
      title: m.title,
      description: m.description || '',
      image_url: m.image_url,
      created_at: m.created_at,
      creator: m.created_by?.display_name || null
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal mengambil memories.' });
  }
});

app.get('/api/messages', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find().populate('member', 'username display_name avatar role').sort({ created_at: -1 }).limit(100).lean();
    res.json(messages.reverse().map(m => ({
      id: m._id.toString(),
      message: m.message,
      created_at: m.created_at,
      member_id: m.member?._id?.toString(),
      username: m.member?.username,
      display_name: m.member?.display_name,
      avatar: m.member?.avatar,
      role: m.member?.role
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal mengambil chat.' });
  }
});

app.post('/api/posts', requireAdmin, async (req, res) => {
  try {
    const { content, image_url = '' } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Isi post wajib diisi.' });
    const post = await Post.create({ author: req.session.user.id, content: content.trim(), image_url: (image_url || '').trim() });
    res.json({ id: post._id.toString(), content: post.content, image_url: post.image_url, created_at: post.created_at });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal membuat post.' });
  }
});

app.delete('/api/posts/:id', requireAdmin, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal hapus post.' });
  }
});

app.post('/api/memories', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description = '', image_url = '' } = req.body;
    const finalUrl = req.file ? `/uploads/${req.file.filename}` : (image_url || '').trim();
    if (!title?.trim() || !finalUrl) return res.status(400).json({ error: 'Judul dan gambar wajib diisi.' });
    const memory = await Memory.create({
      title: title.trim(),
      description: (description || '').trim(),
      image_url: finalUrl,
      created_by: req.session.user.id
    });
    res.json({ id: memory._id.toString(), title: memory.title, description: memory.description, image_url: memory.image_url, created_at: memory.created_at });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal menambah kenangan.' });
  }
});

app.delete('/api/memories/:id', requireAdmin, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    if (memory) {
      if (memory.image_url && memory.image_url.startsWith('/uploads/')) {
        const filePath = path.join(uploadDir, path.basename(memory.image_url));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      await memory.deleteOne();
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal hapus kenangan.' });
  }
});

io.use((socket, next) => sessionMiddleware(socket.request, {}, next));
io.use((socket, next) => (socket.request.session?.user ? next() : next(new Error('UNAUTHORIZED'))));

io.on('connection', (socket) => {
  const user = socket.request.session.user;

  socket.on('chat:send', async (raw) => {
    const message = String(raw || '').trim();
    if (!message || message.length > 1000) return;
    try {
      const doc = await Message.create({ member: user.id, message });
      io.emit('chat:message', {
        id: doc._id.toString(),
        message: doc.message,
        created_at: doc.created_at,
        member_id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar: user.avatar,
        role: user.role
      });
    } catch (e) { console.error(e); }
  });

  socket.on('chat:delete', async (id) => {
    if (!isStaff(user.role)) return;
    try {
      await Message.findByIdAndDelete(id);
      io.emit('chat:deleted', { id });
    } catch (e) { console.error(e); }
  });
});

(async () => {
  await initDb();
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => console.log(`WaliJomok (MongoDB) running on :${port}`));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
