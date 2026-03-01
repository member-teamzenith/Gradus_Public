"use client";
import React, { useState, useEffect } from "react";
import { auth, db } from "../../lib/Firebase";
import { doc, getDoc } from "firebase/firestore";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SubjectAndExams from '../layout/SubjectAndExams';
import { BookOpen, HelpCircle, ChevronRight, Layers } from "lucide-react";
import { getCourseInterest, updateCourseSelection } from "@/services/authServices";

function Courses() {
  const [user, setUser] = useState(null);
  const [course, setCourse] = useState([]);
  const [options, setOptions] = useState([]);
  const [showSubjects, setShowSubjects] = useState(false);
  // const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser.uid);
        await fetchOptions();
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserData = async (uid) => {
    try {
      const data = await getCourseInterest(uid);
      setCourse(data.course || []);
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Error fetching user data!", { position: "bottom-center" });
    }
  };

  const fetchOptions = async () => {
    try {
      const optionsRef = doc(db, "GlobalDB", "Academia");
      const optionsSnap = await getDoc(optionsRef);
      if (optionsSnap.exists()) {
        setOptions(optionsSnap.data().Options || []);
      } else {
        console.error("Academia document does not exist");
        toast.error("Course options not found in database!", { position: "bottom-center" });
      }
    } catch (error) {
      console.error("Error fetching options:", error);
      toast.error("Error fetching options!", { position: "bottom-center" });
    }
  };

  const handleCourseSelection = (selectedCourse) => {
    setCourse((prev) =>
      prev.includes(selectedCourse)
        ? prev.filter((c) => c !== selectedCourse)
        : [...prev, selectedCourse]
    );
    setShowSubjects(false);
  };

  const handleCourseDetails = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("No authenticated user found!", { position: "bottom-center" });
      return;
    }

    if (!course || course.length === 0) {
      toast.error("Please select at least one course!", { position: "bottom-center" });
      return;
    }

    try {
      await updateCourseSelection({
        uid: user.uid,
        course
      });

      toast.success("Course Updated Successfully, Scroll Down!", { position: "top-center" });
      setShowSubjects(false);
      setTimeout(() => setShowSubjects(true), 100);
      // setShowHelp(false);
    } catch (error) {
      toast.error(error.message || "Course update failed!", { position: "bottom-center" });
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-gray-900 to-black px-4 py-10 relative">
      {/* Neon gradient background (subtle glow like CourseInterests) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-400/8 to-teal-500/8 blur-3xl rounded-2xl" />
      </div>

      <div className="w-full max-w-4xl z-10">
        {/* Welcome / Help Box (glass) */}
        

        {/* Course Selection Card (glass) */}
        <div className="relative mb-6">
          {/* glow background */}
          <div className="absolute inset-0 rounded-2xl blur-3xl opacity-20 bg-gradient-to-r from-green-500/15 via-emerald-400/10 to-teal-500/12"></div>

          <div className="relative bg-white/3 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-white/8">
            {/* Header Section */}
            <div className="relative h-32 bg-gradient-to-r from-[#18cb96] to-[#109d76]/50 flex items-center justify-center">
              <div className="absolute inset-0 opacity-10 bg-[url('/grid-pattern.svg')]"></div>
              <div className="flex flex-col items-center z-10">
                <BookOpen className="text-white w-8 h-8 mb-2" />
                <h1 className="text-3xl font-bold text-white">Select Your Course</h1>
              </div>
            </div>

            {/* Course Selection Form */}
            <div className="px-8 py-10">
              <form onSubmit={handleCourseDetails}>
                <div className="mb-8">
                  <p className="text-white font-bold text-xl text-center mb-6">Choose the courses that match your academic journey (select multiple)</p>
                  {options.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {options.map((courses, index) => (
                        <div
                          key={index}
                          onClick={() => handleCourseSelection(courses)}
                          className={`
                            flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 
                            ${course.includes(courses)
                              ? 'bg-[#18cb96]/16 border-2 border-[#18cb96] shadow-lg shadow-[#18cb96]/10'
                              : 'bg-white/4 border-2 border-white/6 hover:border-white/10'}
                          `}
                        >
                          <input
                            type="checkbox"
                            name="course"
                            value={courses}
                            checked={course.includes(courses)}
                            onChange={() => handleCourseSelection(courses)}
                            className="hidden"
                          />
                          <div className="w-10 h-10 rounded-full bg-white/6 flex items-center justify-center mb-3">
                            <Layers className={`w-5 h-5 ${course.includes(courses) ? 'text-[#18cb96]' : 'text-gray-300'}`} />
                          </div>
                          <span className={`text-sm font-medium ${course.includes(courses) ? 'text-[#18cb96]' : 'text-white'}`}>
                            {courses}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-center py-8">
                      <div className="animate-pulse flex flex-col items-center">
                        <div className="w-12 h-12 bg-white/6 rounded-full mb-4"></div>
                        <div className="h-4 bg-white/6 rounded w-32 mb-2"></div>
                        <div className="h-4 bg-white/6 rounded w-24"></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-center mt-6">
                  <button
                    type="submit"
                    className="bg-[#18cb96] hover:bg-[#15b789] text-white font-medium py-3 px-8 rounded-lg shadow-lg hover:shadow-[#18cb9640] transition-all duration-300 flex items-center justify-center"
                  >
                    <span className="mr-2">Continue</span>
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center mt-2 mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
            <div className="w-12 h-1 rounded-full bg-[#18cb96]"></div>
            <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
            <div className="w-12 h-1 rounded-full bg-[#18cb96]"></div>
            <div className="w-3 h-3 rounded-full bg-[#18cb96]"></div>
          </div>
        </div>
        <p className="text-center text-gray-500 mb-8 text-sm">Step 2 of 3 - Course Selection</p>

        {/* Subject and Exams Section */}
        {showSubjects && (
          <div className="w-full mb-10 items-center justify-center animate-fade-in">
            <SubjectAndExams course={course} />
          </div>
        )}

        <ToastContainer />
      </div>
    </div>
  );
}

export default Courses;
