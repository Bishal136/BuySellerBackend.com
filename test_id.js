const mongoose = require('mongoose');
const Setting = require('./src/models/Setting');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce', { useNewUrlParser: true });
  
  let settings = await Setting.findOne();
  if (!settings) settings = await Setting.create({});
  
  try {
    const payload = settings.toObject();
    await Setting.findOneAndUpdate({}, payload, { new: true, runValidators: true });
    console.log("NO ERROR");
  } catch(e) {
    console.log("ERROR:", e.message);
  }
  process.exit();
}
test();
