// 📁 src/app/profile/[id]/UserProfile.tsx
"use client";
import { motion } from "framer-motion";
import React from "react";
import { getAuth, updateProfile } from "firebase/auth";

// ... inside a function where you have the current user object
const auth = getAuth();
const user = auth.currentUser;

if (user) {
  updateProfile(user, {
    displayName: "Your Employee Name Here", // Replace with the actual name
    // photoURL: "https://example.com/profile.png" // Optional: You can also set a photo URL
  })
    .then(() => {
      // Profile updated!
      console.log("User display name updated successfully!");
      // You might want to refresh your component's state or trigger a re-render
    })
    .catch((error) => {
      // An error occurred
      console.error("Error updating profile:", error);
    });
}
export default function UserProfile({ userId }: { userId: string }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center px-4"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1950&q=80')",
      }}
    >
      <motion.div
        className="bg-white bg-opacity-90 backdrop-blur-md rounded-2xl shadow-2xl p-10 max-w-xl w-full text-center"
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-bold mb-4 text-gray-800">User Profile</h1>
        <hr className="mb-6 border-gray-300" />

        <p className="text-lg text-gray-700 mb-2">
          Welcome to the profile page
        </p>
        <motion.span
          className="inline-block mt-4 px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg shadow-md"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
        >
          User ID: {userId}
        </motion.span>
      </motion.div>
    </div>
  );
}
