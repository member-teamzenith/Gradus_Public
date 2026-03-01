import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { useEffect } from "react";
import { auth } from "@/lib/Firebase";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { fetchUserDetails } from "@/services/userServices";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "../../../store/userSlice";
import { sendUserIdToExtension } from "@/utils/userIdToExtension";

function SignInwithGoogle() {
  const router = useRouter();
  const dispatch = useDispatch();
  const videoId = useSelector((state) => state.videoPlayer?.videoId);

  // Handle redirect-based sign-in: when the page loads after redirect,
  // getRedirectResult will return the signed-in user exactly once.
  useEffect(() => {
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        const user = res?.user;
        if (user) {
          dispatch(setUser({
            uid: user?.uid,
            email: user?.email,
            displayName: user?.displayName,
            photoURL: user?.photoURL,
            emailVerified: user?.emailVerified,
          }));
        }
      } catch (_) {
        // ignore
      }
    })();
  }, [dispatch]);

  async function googleLogin() {
    try {
      // --- Step 0: Setup ---
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      if (!auth?.app?.options?.apiKey) {
        throw new Error("Firebase config missing. Check NEXT_PUBLIC_* env vars.");
      }

      // --- Step 1: Sign in with Google ---
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (!user) throw new Error("User not found");

      // Save user to Redux immediately
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

      try { await auth.currentUser?.reload(); } catch (_) { }

      // --- Step 3: Handle unverified users based on DB presence ---
      const isVerified = !!auth.currentUser?.emailVerified;
      if (!isVerified) {
        try {
          // If user exists in DB → go to Verify Email
          await fetchUserDetails(user.uid);
          router.push(`/auth/verify-email?email=${encodeURIComponent(user.email || "")}`);
          return;
        } catch (err) {
          if (err?.response?.status === 404) {
            // Not in DB → first time: take user to Register to set password
            try {
              localStorage.setItem(
                "registration",
                JSON.stringify({ email: user.email || "", source: "google" })
              );
            } catch (_) { }
            router.push(`/auth/register?email=${encodeURIComponent(user.email || "")}&src=google`);
            return;
          }
          throw err;
        }
      }

      // --- Step 4: User is verified → Check if user exists in DB and profile completion flag ---
      let userDetails;
      try {
        userDetails = await fetchUserDetails(user.uid);
      } catch (err) {
        if (err?.response?.status === 404) {
          // Verified but not in DB → treat as first-time and take to Register
          try {
            localStorage.setItem(
              "registration",
              JSON.stringify({ email: user.email || "", source: "google" })
            );
          } catch (_) { }
          router.push(`/auth/register?email=${encodeURIComponent(user.email || "")}&src=google`);
          return;
        }
        throw err;
      }

      const personalFlag = (userDetails?.personalDetailsAdded !== undefined)
        ? userDetails?.personalDetailsAdded
        : userDetails?.data?.personalDetailsAdded;
      if (!personalFlag) {
        router.push("/auth/onBoarding/personal-details");
        return;
      }

      // --- Step 5: Redirect based on videoId ---
      toast.success("Welcome back!", { position: "top-center" });
      if (videoId) {
        router.push(`/videoplayer/${videoId}`);
      } else {
        router.push("/home/welcome");
      }

    } catch (error) {
      // --- Step 6: Error handling ---
      const code = error?.code || "";
      if (code === "auth/popup-closed-by-user") {
        toast.warning("Sign-in popup closed. Please try again.", { position: "top-center" });
      } else if (
        code === "auth/operation-not-supported-in-this-environment" ||
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request"
      ) {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
        } catch (redirectErr) {
          toast.error(redirectErr?.message || "Redirect sign-in failed.", { position: "top-center" });
        }
      } else if (code === "auth/unauthorized-domain") {
        toast.error("Unauthorized domain. Add this domain in Firebase Auth settings.", { position: "top-center" });
      } else if (code === "auth/invalid-api-key") {
        toast.error("Invalid Firebase API key. Check NEXT_PUBLIC_FIREBASE_API_KEY.", { position: "top-center" });
      } else if (code === "auth/invalid-auth") {
        toast.error("Invalid authentication setup. Verify Firebase project configuration.", { position: "top-center" });
      } else {
        toast.error(error?.message || "Something went wrong. Try again later.", { position: "top-center" });
      }
    }
  }

  return (
    <div className="relative top-[25%]">
      <div
        className="imgdiv"
        style={{ display: "flex", justifyContent: "center", cursor: "pointer" }}
        onClick={googleLogin}
      >
        <button className="max-w-[320px] flex px-[1.4rem] py-2 text-sm leading-5 font-bold text-center uppercase align-middle items-center rounded-lg border border-black/25 gap-[0.75rem] text-[#413f3f] bg-white cursor-pointer transition-all duration-600 ease-in-out hover:scale-[1.02]">
          <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" viewBox="0 0 256 262" className="h-6">
            <path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"></path>
            <path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"></path>
            <path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"></path>
            <path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"></path>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

export default SignInwithGoogle;
