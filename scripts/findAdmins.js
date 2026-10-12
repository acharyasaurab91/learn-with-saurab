const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');
  const admins = await users.find({ isAdmin: true })
    .project({ username: 1, email: 1, firstName: 1, lastName: 1, isAdmin: 1, isVerified: 1, createdAt: 1 })
    .toArray();
  
  console.log('Total admin users:', admins.length);
  console.log(JSON.stringify(admins, null, 2));
  process.exit(0);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
