"use client";
import React, { useEffect, useState } from "react";
import { auth } from "@/lib/Firebase";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SignInwithGoogle from "../layout/SignInWithGoogle";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import '@/Styles/navbar.css';
import { signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { fetchUserDetails } from "@/services/userServices";
import { setUser } from "../../../store/userSlice";
import { sendUserIdToExtension } from "@/utils/userIdToExtension";
import OnBoardingNavBar from "../common/onBoardingNavBar";

function Login() {
  const router = useRouter();
  const dispatch = useDispatch();
  const videoId = useSelector((state) => state.videoPlayer.videoId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // console.log('Login: Component rendered, isLoading:', isLoading);


  useEffect(() => {
    // Show any queued toast from previous page (e.g., verification sent)
    try {
      const raw = localStorage.getItem("postAuthToast");
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.message) {
          const kind = data?.type === "success" ? toast.success : toast.info;
          kind(data.message, { position: "top-center" });
        }
        localStorage.removeItem("postAuthToast");
      }
    } catch (_) { }
    // Intentionally no auth state redirect here to avoid any navigation for unverified users
  }, [videoId, router]);

  // Email/password login removed; only Google Sign-In is available now

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      <OnBoardingNavBar />

      {/* Main Content Container (responsive and centered) */}
      <div className="flex items-center justify-center min-h-[calc(100vh-90px)] px-4 sm:px-6 md:px-8">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl relative">
          {/* Neon gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-emerald-400/20 to-teal-500/20 blur-3xl rounded-2xl"></div>

          {/* Login Card */}
          <div className="relative bg-gray-800/40 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-700/50">
            {/* Form Section */}
            <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 text-center">
                Sign in to <span className="text-green-300">Gradus</span>
              </h2>

              {/* Email & Password Login */}
              <div className="flex flex-col items-center">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSubmitting(true);
                    try {
                      const cred = await signInWithEmailAndPassword(auth, email, password);
                      const user = cred.user;
                      // Store minimal auth user in Redux
                      try {
                        dispatch(setUser({
                          uid: user?.uid,
                          email: user?.email,
                          displayName: user?.displayName,
                          photoURL: user?.photoURL,
                          emailVerified: user?.emailVerified,
                        }));
                      } catch (_) { }
                      // Send userId to extension
                      sendUserIdToExtension(user?.uid);
                      if (!user?.emailVerified) {
                        try {
                          await sendEmailVerification(user);
                          toast.success("Verification email sent. Please check your inbox.", { position: "top-center" });
                        } catch (_) {
                          toast.error("Failed to send verification email. Please try again later.", { position: "top-center" });
                        }
                        // Keep session so VerifyEmail page can resend without re-login
                        const targetEmail = user?.email || email;
                        router.push(`/auth/verify-email?email=${encodeURIComponent(targetEmail || "")}`);
                        return;
                      }
                      // Check onboarding completion (personalDetailsAdded flag) before final redirect
                      try {
                        const details = await fetchUserDetails(user.uid);
                        const personalFlag = (details?.personalDetailsAdded !== undefined)
                          ? details?.personalDetailsAdded
                          : details?.data?.personalDetailsAdded;
                        if (!personalFlag) {
                          router.push("/auth/onBoarding/personal-details?from=login");
                          return;
                        }
                      } catch (err) {
                        if (err?.response?.status === 404) {
                          // No user record yet → treat as missing details
                          router.push("/auth/onBoarding/personal-details?from=login");
                          return;
                        }
                        // For other errors, fall through to existing redirects
                      }
                      if (videoId) {
                        router.push(`/videoplayer/${videoId}`);
                      } else {
                        router.push("/home/welcome");
                      }
                    } catch (err) {
                      const code = err?.code || "";
                      let message = "Login failed. Check your credentials.";
                      switch (code) {
                        case "auth/invalid-email":
                          message = "Invalid email format.";
                          break;
                        case "auth/user-disabled":
                          message = "This account has been disabled.";
                          break;
                        case "auth/user-not-found":
                          message = "No user found with this email.";
                          break;
                        case "auth/wrong-password":
                        case "auth/invalid-credential":
                          message = "Incorrect email or password.";
                          break;
                        case "auth/too-many-requests":
                          message = "Too many attempts. Please try again later.";
                          break;
                        case "auth/network-request-failed":
                          message = "Network error. Check your connection and try again.";
                          break;
                        default:
                          if (err?.message) message = err.message;
                      }
                      toast.error(message, { position: "top-center" });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="w-full max-w-sm"
                >
                  <div className="mb-4">
                    <label className="block text-gray-400 text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#18cb96]"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-400 text-sm font-medium mb-2">Password</label>
                    <input
                      type="password"
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#18cb96]"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#18cb96] hover:bg-[#15b789] text-white font-medium py-2 rounded-lg shadow-lg hover:shadow-[#18cb9640] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Signing in..." : "Login"}
                  </button>
                </form>
              </div>

              {/* Google Sign In */}
              <div className="flex flex-col items-center mt-5">
                <p className="text-gray-300 text-xs sm:text-sm mb-3 sm:mb-4">
                  New user? <Link href="/auth/register" className="text-green-300 hover:text-green-200 font-semibold">Create an account</Link>
                </p>
                <SignInwithGoogle />
                <p className="text-gray-400 text-xs sm:text-sm mt-3 sm:mt-4 text-center px-2">
                  Use your Google account to continue
                </p>
              </div>
            </div>
          </div>

          {/* Cool tagline */}
          <p className="text-gray-500 text-center mt-4 sm:mt-6 text-xs sm:text-sm px-4">
            Learn, Connect, Grow Your educational journey starts here
          </p>
        </div>
      </div>

      {/* Toast Container for notifications */}
      <ToastContainer />
    </div>
  );
}

export default Login;