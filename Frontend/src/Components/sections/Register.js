"use client";
import { createUserWithEmailAndPassword, sendEmailVerification, EmailAuthProvider, linkWithCredential } from "firebase/auth";
import { registerUser as registerUserApi } from "@/services/authServices";
import React, { useEffect, useState } from "react";
import { auth } from "@/lib/Firebase";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { Mail, Lock, CheckCircle } from "lucide-react";
import OnBoardingNavBar from "../common/onBoardingNavBar";

// Allowed email domains for registration
const ALLOWED_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "live.com",
  "msn.com",
  "rediffmail.com",
  "yandex.com",
  "mail.com",
]);

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [Cnfpassword, setCnfPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Resend moved to VerifyEmail screen; keep UI simple here
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const router = useRouter();

  // Prefill email if provided via localStorage or query param
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryEmail = params.get("email");
      const source = params.get("src");
      if (queryEmail && source === "google") {
        setEmail(queryEmail);
        return;
      }
    } catch (_) {}
    try {
      const raw = localStorage.getItem("registration");
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.email && data?.source === "google") setEmail(data.email);
        // Clear once consumed to avoid unintended prefill later
        try { localStorage.removeItem("registration"); } catch (_) {}
      }
    } catch (_) {}
  }, []);

  // Note: cooldown/resend handled on VerifyEmail page now

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    // Validate email domain before proceeding
    const domain = (email || "").trim().toLowerCase().split("@")[1] || "";
    if (!ALLOWED_EMAIL_DOMAINS.has(domain)) {
      toast.error("Authorization blocked,please use a valid email", { position: "bottom-center" });
      return;
    }

    if (password !== Cnfpassword) {
      toast.error("Passwords do not match!", { position: "bottom-center" });
      return;
    }

    setIsLoading(true);

    try {
      let currentUser = auth.currentUser;
      if (currentUser && currentUser.providerData.some(p => p.providerId === 'google.com')) {
        // User came from Google sign-in; link email/password to the same account
        const credential = EmailAuthProvider.credential(email, password);
        const linked = await linkWithCredential(currentUser, credential);
        currentUser = linked.user;
        await sendEmailVerification(currentUser);
      } else {
        // Normal email/password registration flow
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        await sendEmailVerification(currentUser);
      }

      localStorage.setItem(
        "registration",
        JSON.stringify({
          email
        })
      );

      setMessage(`Verification email sent to ${email}. Please check your inbox and spam folder.`);

      // Save basic user info in cache via authServices (with personalDetailsAdded: false)
      try {
        const uid = auth.currentUser?.uid;
        if (uid) {
          await registerUserApi(uid, email);
        }
      } catch (_) {}

      setEmail("");
      setPassword("");
      setCnfPassword("");

      // Redirect user to Verify Email screen
      router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);

    } catch (error) {
      if (error?.code === 'auth/email-already-in-use') {
        toast.error("Email already exists", { position: "bottom-center" });
      } else {
        toast.error(error.message, { position: "bottom-center" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Resend logic moved to VerifyEmail page


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      <OnBoardingNavBar />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-90px)] px-4">
        <div className="w-full max-w-md relative">
          {/* Neon gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-emerald-400/20 to-teal-500/20 blur-3xl rounded-2xl"></div>
          
          {/* Registration Card */}
          <div className="relative bg-gray-800/40 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-700/50">
            {/* Form Section */}
            <div className="px-8 py-6">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Create Account</h2>
            {message && (
              <div className="mb-4 rounded-md border border-green-400 bg-green-900/30 text-green-300 px-4 py-3 text-sm">
                {message}
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-md border border-red-400 bg-red-900/30 text-red-300 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister}>
              {/* Email Input */}
              <div className="mb-5">
                <label className="block text-gray-400 text-sm font-medium mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-[#18cb96] transition-all duration-300"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-5">
                <label className="block text-gray-400 text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-[#18cb96] transition-all duration-300"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="mb-6">
                <label className="block text-gray-400 text-sm font-medium mb-2">Confirm Password</label>
                <div className="relative">
                  <CheckCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-[#18cb96] transition-all duration-300"
                    placeholder="Confirm your password"
                    value={Cnfpassword}
                    onChange={(e) => setCnfPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Sign Up Button */}
              <button
                type="submit"
                className="w-full bg-[#18cb96] hover:bg-[#15b789] text-white font-medium py-3 rounded-lg shadow-lg hover:shadow-[#18cb9640] transition-all duration-300 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Signing up...
                  </>
                ) : (
                  <>
                    <span className="mr-2">Sign Up</span>
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>

              {/* Login Link */}
              <div className="mt-6 text-center">
                <p className="text-gray-400">
                  Already have an account? <a href="/auth/login" className="text-[#18cb96] hover:text-[#15b789] font-medium">Log in</a>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Cool tagline */}
        <p className="text-gray-500 text-center mt-6 text-sm">Join thousands of students on their learning journey</p>
      </div>
      </div>

      {/* Toast Container for notifications */}
      <ToastContainer />
    </div>
  );
}

export default Register;