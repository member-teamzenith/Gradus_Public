"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "../../../store/userSlice";
import { updateUserTime } from "@/services/userServices";

const TimeTracker = () => {
  const [timeSpent, setTimeSpent] = useState(0);
  const reduxUser = useSelector(selectUser);
  const [isPageActive, setIsPageActive] = useState(true);
  const timerRef = useRef(null);

  // Reset time counter when a user appears
  useEffect(() => {
    if (!reduxUser) return;
    // Initialize time spent to 0 - backend will handle fetching current time
    setTimeSpent(0);
  }, [reduxUser]);

  useEffect(() => {
    if (!reduxUser || !isPageActive) return;

    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
      setTimeSpent((prev) => {
        const newTime = prev + 1;
        saveTimeToBackend(newTime);
        return newTime;
      });
    }, 60000); // 1 minute

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPageActive, reduxUser]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageActive(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const saveTimeToBackend = async (time) => {
    if (!reduxUser) return;

    try {
      await updateUserTime(reduxUser.uid, time);
      // console.log('TimeTracker - Successfully saved time');
    } catch (error) {
      console.error("TimeTracker - Error saving time:", error);
    }
  };

  return null;
};

export default TimeTracker;
