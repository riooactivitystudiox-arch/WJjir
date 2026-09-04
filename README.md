# WaliJomok Full-Stack (MongoDB)

Node.js + Express + **MongoDB** + Socket.IO

## Fitur
- Login wajib (username + password)
- Password default: **`111wj`**
- Role: **Creator**, **Admin**, **Member**
- Creator: Derio
- Global Chat realtime
- Posts & Memories (Admin/Creator)
- Admin panel: tambah / edit / hapus / nonaktifkan member
- Setiap member bisa edit profile sendiri (nama, bio, avatar)

## Login
- Username contoh: `derio`, `andes_lawal`, `geo_jmk48`, ...
- Password: `111wj`

## Role
| Role | Akses |
|------|-------|
| Creator | Semua fitur admin + kelola Creator |
| Admin | Post, Memory, kelola Member |
| Member | Chat + edit profile sendiri |

## Railway
1. Tambah **MongoDB** service
2. Set env:
   - `MONGODB_URI`
   - `SESSION_SECRET`
3. Start: `npm start`
