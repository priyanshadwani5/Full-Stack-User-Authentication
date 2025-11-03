import mongoose from "mongoose";

let isConnected = false; // Prevent multiple connections

export async function connect() {
  if (isConnected) {
    console.log("✅ Already connected to MongoDB.");
    return;
  }

  const mongoUri =
    "mongodb+srv://Priyansh:Priyansh123@cluster0.zakhuf0.mongodb.net/my-app?retryWrites=true&w=majority&";

  if (!mongoUri) {
    throw new Error("❌ MONGO_URI is not defined in environment variables.");
  }

  try {
    const db = await mongoose.connect(mongoUri);

    isConnected = true;
    console.log(`✅ MongoDB connected to: ${db.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}
