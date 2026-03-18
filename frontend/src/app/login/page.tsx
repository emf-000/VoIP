"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectSocket } from "@/lib/socket";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); 
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;

    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("loginTime", Date.now().toString())

      connectSocket(data.token);

      router.push("/");
    } catch (error) {
      console.error("Login error:", error);
      alert("Something went wrong");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="bg-gray-900 p-6 md:p-8 rounded-lg w-full max-w-md space-y-4">
        
        <h2 className="text-xl md:text-2xl font-bold text-center">Login</h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2.5 md:p-3 rounded bg-gray-800 text-sm md:text-base"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="w-full p-2.5 md:p-3 pr-12 rounded bg-gray-800 text-sm md:text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            {showPassword ? "🔒" : "👁"}
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 p-2.5 md:p-3 rounded text-sm md:text-base"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="text-center text-xs md:text-sm">
          Don’t have an account?{" "}
          <span
            className="text-blue-400 cursor-pointer hover:underline"
            onClick={() => router.push("/register")}
          >
            Register
          </span>
        </p>

      </div>
    </div>
  );
}