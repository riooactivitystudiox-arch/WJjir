const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const memberSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true, lowercase: true },
  display_name: { type: String, required: true, trim: true },
  role: { type: String, enum: ['Creator', 'Admin', 'Member'], default: 'Member' },
  verified: { type: Boolean, default: false },
  avatar: { type: String, default: '../images/blank.png' },
  bio: { type: String, default: '' },
  password_hash: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  content: { type: String, required: true, trim: true },
  image_url: { type: String, default: '' }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const memorySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  image_url: { type: String, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const messageSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  message: { type: String, required: true, trim: true, maxlength: 1000 }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const Member = mongoose.model('Member', memberSchema);
const Post = mongoose.model('Post', postSchema);
const Memory = mongoose.model('Memory', memorySchema);
const Message = mongoose.model('Message', messageSchema);

const seedMembers = [
  ['derio', 'Derio', 'Creator', true],
  ['andes_lawal', 'Andes Lawal', 'Admin', true],
  ['geo_jmk48', 'geo jmk48', 'Admin', true],
  ['ridho_athalla', 'Ridho Athalla', 'Admin', true],
  ['dimas_dewa', 'Dimas Dewa', 'Member', false],
  ['atha_rasyid', 'Atha Rasyid XF', 'Member', false],
  ['doni_king', 'Doni King', 'Member', false],
  ['findra', 'findra', 'Member', false],
  ['iqbal_jir', 'iqbal jir', 'Member', false],
  ['rasyid', 'rasyid', 'Member', false],
  ['rifki_biji', 'Rifki Biji', 'Member', false],
  ['new_member', 'New Member', 'Member', false]
];

async function connectDb() {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) throw new Error('MONGODB_URI tidak ditemukan di environment');
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

async function initDb() {
  await connectDb();
  const hash = await bcrypt.hash('111wj', 12);

  for (const [username, display_name, role, verified] of seedMembers) {
    await Member.findOneAndUpdate(
      { username },
      {
        $setOnInsert: {
          username,
          display_name,
          role,
          verified,
          password_hash: hash,
          active: true,
          avatar: '../images/blank.png',
          bio: role === 'Creator' ? 'Creator of WaliJomok' : ''
        }
      },
      { upsert: true, new: true }
    );
  }

  // Ensure Derio always has Creator role if already exists
  await Member.findOneAndUpdate(
    { username: 'derio' },
    { $set: { role: 'Creator', verified: true, display_name: 'Derio' } }
  );

  const postCount = await Post.countDocuments();
  if (postCount === 0) {
    const derio = await Member.findOne({ username: 'derio' });
    const andes = await Member.findOne({ username: 'andes_lawal' });
    if (derio && andes) {
      await Post.insertMany([
        {
          author: derio._id,
          content: 'Halo semua! Saya Derio, Creator WaliJomok. Selamat datang di komunitas kita 🔥'
        },
        {
          author: andes._id,
          content: 'Selamat datang di komunitas WaliJomok! Semua avatar masih blank, silakan custom sesuai keinginan. Stay solid 🔥'
        }
      ]);
    }
  }

  const memCount = await Memory.countDocuments();
  if (memCount === 0) {
    const derio = await Member.findOne({ username: 'derio' });
    if (derio) {
      await Memory.create({
        title: 'Group Photo',
        description: 'WaliJomok group photo',
        image_url: '/assets/banner-group.jpg',
        created_by: derio._id
      });
    }
  }
}

module.exports = { mongoose, Member, Post, Memory, Message, initDb, connectDb };
