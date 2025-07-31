"use client";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

type MessageType = {
  text: string;
  type: "success" | "error";
};

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<string>("nothing");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<MessageType | null>(null);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const logout = async () => {
    try {
      const res = await fetch("/api/users/logout", {
        method: "GET",
      });

      if (res.ok) {
        showMessage("Logout successful", "success");

        // Delay before redirect to ensure cookie is cleared
        setTimeout(() => {
          router.replace("/login");
        }, 1000);
      } else {
        const data = await res.json();
        throw new Error(data?.error || "Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
      showMessage("Logout failed", "error");
    }
  };

  const getUserDetails = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // Simulated user ID (replace with actual API call in real app)
      const dummyUserId = "user_12345abcde";
      setData(dummyUserId);
      showMessage("User data fetched (simulated)", "success");
    } catch (error) {
      console.error("Get user details error:", error);
      showMessage("Failed to fetch user details", "error");
    }
    setLoading(false);
  };

  const handleViewDashboard = () => {
    router.push("/projects");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center p-6"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1950&q=80')",
      }}
    >
      <div className="bg-white bg-opacity-90 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">
          👤 Profile Page
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Welcome to your profile.
        </p>

        {/* Message Box */}
        {message && (
          <div
            className={`text-center py-2 px-4 mb-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="text-center mb-6">
          <p className="text-md font-medium text-gray-700 mb-1">User ID:</p>
          <div className="bg-green-100 text-green-800 py-2 px-4 rounded-lg break-all text-sm">
            {data === "nothing" ? (
              "Click 'Get User Details' to fetch your ID."
            ) : (
              <span
                onClick={() => router.push(`/profile/${data}`)}
                className="underline text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {data}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={getUserDetails}
            className="bg-green-600 hover:bg-green-700 transition text-white font-semibold py-2 px-4 rounded-xl"
            disabled={loading}
          >
            {loading ? "Fetching..." : "🔍 Get User Details"}
          </button>

          <button
            onClick={handleViewDashboard}
            className="bg-blue-600 hover:bg-blue-700 transition text-white font-semibold py-2 px-4 rounded-xl"
          >
            📊 View Dashboard
          </button>

          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 transition text-white font-semibold py-2 px-4 rounded-xl"
          >
            🚪 Logout
          </button>
        </div>
      </div>
    </div>
  );
}
