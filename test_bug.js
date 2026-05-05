const mongoose = require('mongoose');
const Setting = require('./src/models/Setting');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce', { useNewUrlParser: true });
  
  let settings = await Setting.findOne();
  if (!settings) settings = await Setting.create({});
  
  try {
    const payload = settings.toObject();
    // try to update with _id
    await Setting.findOneAndUpdate({}, payload, { new: true, runValidators: true });
    console.log("Success");
  } catch (err) {
    console.error("Error:", err.message);
  }
  mongoose.disconnect();
}
test();
