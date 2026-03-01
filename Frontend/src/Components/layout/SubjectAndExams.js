"use client";
import React, { useState, useEffect, useCallback } from "react";
import { auth, db } from "../../lib/Firebase";
import { doc, getDoc } from "firebase/firestore";
import { toast, ToastContainer } from "react-toastify";
import { getCourseInterest, updateAcademicPreferences } from "@/services/authServices";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap } from "lucide-react";

function SubjectAndExams({ course: courseProp }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [course, setCourse] = useState(courseProp || []);
  const [subOptions, setSubOptions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [hasInterests, setHasInterest] = useState(false);

  // Update course when prop changes
  useEffect(() => {
    if (courseProp) {
      setCourse(courseProp);
    }
  }, [courseProp]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser.uid);
      } else {
        setUser(null);
        toast.error("User not logged in!", { position: "bottom-center" });
        router.push("/lauth/ogin");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchUserData = useCallback(async (uid) => {
    try {
      const data = await getCourseInterest(uid);
      // console.log("Fetched user data:", data);
      // Only set course from service if no prop was provided
      if (!courseProp) {
        setCourse(data.course || []);
      }
      setSubjects(data.subjects || []);
      // hasInterests can be boolean or string "true"/"false" from backend
      const hasInterestsValue = data.hasInterests === true || data.hasInterests === "true";
      setHasInterest(hasInterestsValue);
      // console.log("Fetched hasInterests:", data.hasInterests, "Parsed as:", hasInterestsValue);
      // console.log("Course:", data.course, "Subjects:", data.subjects, "Exams:", data.exams);
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Error fetching user data!", { position: "bottom-center" });
    }
  }, [courseProp]);

  const fetchSubOptions = useCallback(async () => {
    if (!course || course.length === 0) {
      console.warn("Course is empty, cannot fetch subjects");
      setSubOptions([]);
      return;
    }
    try {
      // Fetch subjects from all selected courses
      const allSubjects = [];
      
      for (const selectedCourse of course) {
        const subjectsPath = `GlobalDB/Academia/${selectedCourse}/Subjects`;
        const subjectsRef = doc(db, "GlobalDB", "Academia", selectedCourse, "Subjects");
        const subjectsSnap = await getDoc(subjectsRef);
        
        if (subjectsSnap.exists()) {
          const data = subjectsSnap.data();
          const fetchedSubjects = data.Options || [];
          // Add course prefix to subjects to avoid duplicates
          fetchedSubjects.forEach(subject => {
            if (!allSubjects.includes(subject)) {
              allSubjects.push(subject);
            }
          });
        } else {
          console.error("Subjects document does not exist at path:", subjectsPath);
        }
      }
      
      setSubOptions(allSubjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      toast.error("Error fetching subjects!", { position: "bottom-center" });
    }
  }, [course]);



  useEffect(() => {
    if (user && course && course.length > 0) {
      setSubjects([]);
      fetchSubOptions();
    }
  }, [user, course, fetchSubOptions]);

  const handleSubjectSelection = (subject) => {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error("No authenticated user found!", { position: "bottom-center" });
      return;
    }

    if (subjects.length === 0) {
      toast.error("Please select at least one Subject!", { position: "bottom-center" });
      return;
    }

    try {
      await updateAcademicPreferences({
        uid: user.uid,
        subjects
      });

      toast.success("Subjects Updated Successfully!", { position: "top-center" });
      // Check hasInterests to determine next step
      // console.log("hasInterests value:", hasInterests, "Type:", typeof hasInterests);
      router.push("/auth/onBoarding/interests");
      // if (hasInterests) {
      //   // User selected interests in CourseInterests, go to Interests page
      //   console.log("Redirecting to /auth/onBoarding/interests");

      // } else {
      //   // No interests selected, go directly to profile
      //   console.log("Redirecting to /dashboard/profile");
      //   router.push("/auth/onBoarding/interests");
      // }
    } catch (error) {
      toast.error("Error updating data!", { position: "bottom-center" });
    }
  };


  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative"
    >
      {/* Soft glow like CourseInterests */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-400/8 to-teal-600/10 blur-3xl" />
      </div>

      <div className="w-full max-w-3xl relative z-10">
        {/* GLASS CARD */}
        <div className="relative rounded-3xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-xl overflow-hidden">

          {/* HEADER (glass morphism gradient) */}
          <div className="relative h-36 bg-gradient-to-r from-[#18cb96]/60 to-[#109d76]/40 flex items-center justify-center">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-xl opacity-20" />
            <div className="flex flex-col items-center z-10">
              <GraduationCap className="text-white w-10 h-10 mb-2" />
              <h1 className="text-3xl font-bold text-white">
                Choose Your Academic Focus
              </h1>
            </div>
          </div>

          {/* FORM CONTENT */}
          <div className="px-8 py-10">
            <form onSubmit={handleSubmit}>

              {/* SUBJECTS */}
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="text-[#18cb96] w-5 h-5" />
                  <h2 className="text-xl text-white font-semibold">Your Subjects</h2>
                </div>

                <div className="rounded-xl p-5 bg-white/5 backdrop-blur-lg border border-white/10 shadow-inner">
                  <p className="text-gray-200 text-sm mb-4">
                    Select the subjects you&apos;re studying:
                  </p>

                  <div className="flex flex-wrap gap-3">
                    {subOptions.map((subject, index) => (
                      <div
                        key={index}
                        onClick={() => handleSubjectSelection(subject)}
                        className={`px-4 py-2 rounded-lg cursor-pointer transition-all
                        border backdrop-blur-md
                        ${subjects.includes(subject)
                            ? "bg-[#18cb96]/20 border-[#18cb96] text-white shadow-lg shadow-[#18cb96]/30"
                            : "bg-white/10 border-white/20 text-gray-300 hover:bg-white/20"
                          }`}
                      >
                        {subject}
                      </div>
                    ))}

                    {subOptions.length === 0 && (
                      <p className="text-gray-400 italic w-full text-center">
                        No subjects available.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* SUBMIT */}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#18cb96] text-black font-semibold
                hover:bg-[#13b784] transition shadow-lg shadow-[#18cb96]/40"
              >
                Continue
              </button>
            </form>
          </div>
        </div>

        {/* Progress */}
        <div className="flex justify-center mt-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
            <div className="w-12 h-1 rounded-full bg-[#18cb96]"></div>
            <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
            <div className="w-12 h-1 rounded-full bg-gray-600"></div>
            <div className="w-3 h-3 rounded-full bg-gray-600"></div>
          </div>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}

export default SubjectAndExams;