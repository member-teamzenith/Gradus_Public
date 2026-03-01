"use client"
import React, { useState, useEffect } from "react";
import { auth } from "../../lib/Firebase";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { BookOpen, Bookmark, Book } from "lucide-react";
import { updateCourseInterest, getCourseInterest } from "@/services/authServices";
import OnBoardingNavBar from "../common/onBoardingNavBar";

function CourseInterest() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [hasCourse, setHasCourse] = useState(false);
    const [hasInterests, setHasInterests] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                fetchUserData(currentUser.uid);
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchUserData = async (uid) => {
        try {
            const data = await getCourseInterest(uid);
            setHasCourse(data.hasCourse || false);
            setHasInterests(data.hasInterests || false);
        } catch (error) {
            console.error("Error fetching user data:", error);
            toast.error("Failed to load user preferences", { position: "bottom-center" });
        }
    };

    const handleSubjectDetails = async (e) => {
        e.preventDefault();

        if (!user) {
            toast.error("No authenticated user found!", { position: "bottom-center" });
            return;
        }

        if (!hasCourse && !hasInterests) {
            toast.error("Please select at least one option!", { position: "bottom-center" });
            return;
        }

        try {
            await updateCourseInterest({
                uid: user.uid,
                hasCourse,
                hasInterests
            });

            toast.success("Course & Interest Updated Successfully!", { position: "top-center" });
        
            if (hasCourse) {
                router.push("/auth/onBoarding/courses");
            } else {
                router.push("/auth/onBoarding/interests");
            }
        } catch (error) {
            toast.error(error.message || "Failed to update.", { position: "bottom-center" });
        }
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
            <OnBoardingNavBar />
            
            <div className="flex items-center justify-center min-h-[calc(100vh-90px)] px-4 py-10">
                <div className="w-full max-w-3xl relative">
                    {/* Neon gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-emerald-400/20 to-teal-500/20 blur-3xl rounded-2xl"></div>
                    
                    {/* Course Interest Card */}
                    <div className="relative bg-gray-800/40 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-700/50">
                        {/* Form Section */}
                        <div className="px-8 py-10">
                            <div className="flex items-center justify-center gap-3 mb-8">
                                <BookOpen className="text-green-300 w-7 h-7" />
                                <h1 className="text-2xl md:text-3xl font-bold text-white">What Are You Looking For?</h1>
                            </div>
                        <form onSubmit={handleSubjectDetails}>
                            <div className="flex flex-col items-center">
                                <p className="text-white text-xl font-bold text-center mb-8">Choose your path to personalize your experience</p>

                                {/* Selection Options */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-lg">
                                    {/* Academia Option */}
                                    <div>
                                        <input
                                            type="checkbox"
                                            id="academia"
                                            className="peer sr-only"
                                            checked={hasCourse}
                                            onChange={(e) => setHasCourse(e.target.checked)}
                                        />
                                        <label
                                            htmlFor="academia"
                                            className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-gray-700 bg-gray-700/50 text-white p-4 cursor-pointer transition-all duration-300 hover:border-[#18cb96] peer-checked:border-[#18cb96] peer-checked:bg-[#18cb96]/10 peer-checked:shadow-md peer-checked:shadow-[#18cb96]/20"
                                        >
                                            <div className="w-16 h-16 rounded-full bg-gray-900/50 flex items-center justify-center mb-4">
                                                <Book className="text-[#18cb96] w-8 h-14" />
                                            </div>
                                            <h3 className="text-xl font-semibold">Academia</h3>
                                            <p className="text-sm text-gray-400 text-center mt-2">Course-based learning & academic subjects</p>
                                        </label>
                                    </div>

                                    {/* Beyond Option */}
                                    <div>
                                        <input
                                            type="checkbox"
                                            id="beyond"
                                            className="peer sr-only"
                                            checked={hasInterests}
                                            onChange={(e) => setHasInterests(e.target.checked)}
                                        />
                                        <label
                                            htmlFor="beyond"
                                            className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-gray-700 bg-gray-700/50 text-white p-4 cursor-pointer transition-all duration-300 hover:border-[#18cb96] peer-checked:border-[#18cb96] peer-checked:bg-[#18cb96]/10 peer-checked:shadow-md peer-checked:shadow-[#18cb96]/20"
                                        >
                                            <div className="w-16 h-16 rounded-full bg-gray-900/50 flex items-center justify-center mb-4">
                                                <Bookmark className="text-[#18cb96] w-8 h-14" />
                                            </div>
                                            <h3 className="text-xl font-semibold">Beyond</h3>
                                            <p className="text-sm text-gray-400 text-center mt-2">Modern technologies & related stuff</p>
                                        </label>
                                    </div>
                                </div>

                                {/* Continue Button */}
                                <div className="mt-10 flex justify-center">
                                    <button
                                        type="submit"
                                        className="bg-[#18cb96] hover:bg-[#15b789] text-white font-medium px-8 py-2 rounded-lg shadow-lg hover:shadow-[#18cb9640] transition-all duration-300 flex items-center justify-center text-sm"
                                    >
                                        <span className="mr-2">Continue</span>
                                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Progress Indicator */}
                <div className="flex justify-center mt-6">
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
                        <div className="w-12 h-1 rounded-full bg-[#18cb96]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
                        <div className="w-12 h-1 rounded-full bg-gray-600"></div>
                        <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                    </div>
                </div>
                <p className="text-center text-gray-500 mt-2 text-sm">Step 2 of 3 - Your Interests</p>
            </div>
            </div>

            {/* Toast Container for notifications */}
            <ToastContainer />
        </div>
    );
}

export default CourseInterest;