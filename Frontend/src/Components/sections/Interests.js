"use client";
import React, { useState, useEffect, useCallback } from "react";
import { auth, db } from "../../lib/Firebase";
import { doc, getDoc } from "firebase/firestore";
import { toast, ToastContainer } from "react-toastify";
import { getCourseInterest, updateInterests } from "@/services/authServices";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { Heart, Lightbulb, ChevronRight, InfoIcon } from "lucide-react";

function Interests() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [interestsOptions, setInterestsOptions] = useState([]);
  const [interests, setInterests] = useState([]);
  const [infoOpen, setInfoOpen] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser.uid);
      } else {
        setUser(null);
        toast.error("User not logged in!", { position: "bottom-center" });
        router.push("/auth/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchUserData = async (uid) => {
    try {
      const data = await getCourseInterest(uid);
      setInterests(data.interests || []);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchInterestsOptions = useCallback(async () => {
    try {
      const interestsRef = doc(db, "GlobalDB", "Beyond");
      const interestsSnap = await getDoc(interestsRef);

      if (interestsSnap.exists()) {
        const data = interestsSnap.data();
        if (data && data.Options) {
          setInterestsOptions(data.Options);
        } else {
          toast.error("Error: No interests options found!", {
            position: "bottom-center",
          });
        }
      } else {
        toast.error("Error: Interests document does not exist!", {
          position: "bottom-center",
        });
      }
    } catch (error) {
      toast.error("Error fetching interests options!", {
        position: "bottom-center",
      });
    }
  }, []);

  useEffect(() => {
    fetchInterestsOptions();
  }, [fetchInterestsOptions]);

  const handleInterestSelection = (interest) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((e) => e !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (interests.length === 0) {
      toast.error("Please select at least one interest!", {
        position: "bottom-center",
      });
      return;
    }
    if (!user) {
      toast.error("No authenticated user found!", {
        position: "bottom-center",
      });
      return;
    }
    try {
      await updateInterests({
        uid: user.uid,
        interests,
      });

      toast.success("Interests updated successfully!", {
        position: "top-center",
      });
      router.push("/home/feed");
    } catch (error) {
      toast.error("Error updating data!", { position: "bottom-center" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative bg-gradient-to-br from-black to-gray-900">
      {/* Soft glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-400/8 to-teal-600/10 blur-3xl" />
      </div>

      <div className="w-full max-w-3xl relative z-10">
        {/* MAIN GLASS CARD */}
        <div className="relative rounded-3xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-xl overflow-hidden">

          {/* Header with gradient glass */}
          <div className="relative h-36 bg-gradient-to-r from-[#18cb96]/60 to-[#109d76]/40 flex items-center justify-center">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-xl opacity-20" />
            <div className="flex flex-col items-center z-10">
              <Heart className="text-white w-10 h-10 mb-2" />
              <h1 className="text-3xl font-bold text-white">What Do You Love?</h1>
            </div>
          </div>

          {/* FORM AREA */}
          <div className="px-8 py-10">

            {/* INFO BOX (glass) */}
            {infoOpen && (
              <div className="relative mb-6">
                <div className="absolute -inset-1 rounded-xl blur-xl opacity-30 bg-gradient-to-r from-[#18cb96]/20 via-[#10a071]/10 to-[#18cb96]/10"></div>

                <div className="relative bg-white/8 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-gray-200 shadow-lg">
                  <div className="flex items-start">
                    <Lightbulb className="w-5 h-5 text-[#18cb96] mr-3 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-medium text-[#18cb96] mb-1">
                        Why We Ask About Your Interests
                      </h3>
                      <p className="text-sm">
                        Selecting your interests helps personalize your Gradus experience.
                      </p>
                    </div>
                    <button
                      onClick={() => setInfoOpen(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M6 18L18 6M6 6l12 12"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-10">
                {/* INTEREST SELECTION */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Heart className="text-[#18cb96] w-5 h-5" />
                    <h2 className="text-xl font-semibold text-white">
                      Select Your Interests
                    </h2>
                  </div>

                  <div className="rounded-xl p-5 bg-white/5 backdrop-blur-lg border border-white/10 shadow-inner">
                    <p className="text-gray-200 text-sm mb-4">
                      Choose activities and topics that interest you:
                    </p>

                    {interestsOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {interestsOptions.map((interest, index) => (
                          <div
                            key={index}
                            onClick={() => handleInterestSelection(interest)}
                            className={`px-4 py-2 rounded-lg border cursor-pointer backdrop-blur-md transition-all
                              ${
                                interests.includes(interest)
                                  ? "bg-[#18cb96]/20 border-[#18cb96] text-white shadow-lg shadow-[#18cb96]/30"
                                  : "bg-white/10 border-white/20 text-gray-300 hover:bg-white/20"
                              }`}
                          >
                            {interest}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-20">
                        <div className="animate-pulse flex space-x-2">
                          <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                          <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                          <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 text-gray-300 text-sm flex items-center">
                      <InfoIcon className="w-4 h-4 mr-2 text-[#18cb96]" />
                      Selected: {interests.length}{" "}
                      {interests.length === 1 ? "interest" : "interests"}
                    </div>
                  </div>
                </div>

                {/* SUBMIT */}
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#18cb96] text-black font-semibold
                  hover:bg-[#13b784] transition shadow-lg shadow-[#18cb96]/40"
                >
                  <span className="mr-2">Complete Profile</span>
                  <ChevronRight className="w-5 h-5 inline" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* PROGRESS INDICATOR */}
        <div className="flex justify-center mt-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
            <div className="w-12 h-1 rounded-full bg-[#18cb96]"></div>
            <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
            <div className="w-12 h-1 rounded-full bg-[#18cb96]"></div>
            <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
          </div>
        </div>
        <p className="text-center text-gray-500 mb-8 text-sm">Step 3 of 3 - Interests Selection</p>
      </div>

      <ToastContainer />
    </div>
  );
}

export default Interests;
