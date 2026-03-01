import React, { useEffect, useState } from "react";
import { auth } from "@/lib/Firebase";
import { fetchUserActivity } from "@/services/userServices";
import dayjs from "dayjs";
import "dayjs/locale/en";
import localeData from "dayjs/plugin/localeData";

dayjs.extend(localeData);

const Heatmap = () => {
  const [activityData, setActivityData] = useState({});
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);
  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [isMobile, setIsMobile] = useState(false);


  useEffect(() => {
    const fetchActivityData = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const result = await fetchUserActivity(user.uid);
          setActivityData(result.activity || {});
        } catch (error) {
          console.error("Error fetching activity data:", error);
          // Set empty activity data for new users or when there's an error
          setActivityData({});
        }
      }
    };

    fetchActivityData();
  }, []);

  // Handle screen size changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    // Set initial value
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // Get Color Based on Time Spent
  const getColor = (timeSpent) => {
    if (timeSpent > 120) return "bg-green-900";
    if (timeSpent > 60) return "bg-green-800";
    if (timeSpent > 30) return "bg-green-600";
    if (timeSpent > 15) return "bg-green-400";
    if (timeSpent > 0) return "bg-green-200";
    return "bg-gray-200";
  };

  // Render Heatmap for Three Months (Desktop) or One Month (Mobile)
  const renderHeatmap = () => {
    const monthGrids = [];
    const monthsToShow = isMobile ? 1 : 3; // Show 1 month on mobile, 3 on desktop
    
    for (let m = monthsToShow - 1; m >= 0; m--) {
      const month = currentMonth - m <= 0 ? 12 + (currentMonth - m) : currentMonth - m;
      const year = currentMonth - m <= 0 ? currentYear - 1 : currentYear;
      const startOfMonth = dayjs().year(year).month(month - 1).startOf('month');
      const endOfMonth = dayjs().year(year).month(month - 1).endOf('month');
      const daysInMonth = endOfMonth.date();
      const firstDayOfWeek = startOfMonth.day();
      const days = [];

      // Add empty divs for alignment (if month doesn't start on Sunday)
      for (let i = 0; i < firstDayOfWeek; i++) {
        days.push(<div key={`empty-${month}-${i}`} className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />);
      }

      // Add days with activity data
      for (let d = 1; d <= daysInMonth; d++) {
        const date = dayjs().year(year).month(month - 1).date(d).format("YYYY-MM-DD");
        const timeSpent = activityData[date] || 0;
        days.push(
          <div
            key={date}
            className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 rounded-md ${getColor(timeSpent)}`}
            title={`${date}: ${timeSpent} mins`}
          />
        );
      }

      // Push the month grid to the main array
      monthGrids.push(
        <div key={month} className="mx-1 sm:mx-2">
          <h3 className="text-sm sm:text-md mb-1 text-white text-center">{dayjs().year(year).month(month - 1).format("MMM YYYY")}</h3>
          <div className="grid grid-cols-7 gap-1 justify-center">
            {days}
          </div>
        </div>
      );
    }
    return monthGrids;
  };

  // Get the date 12 months ago
  const getTwelveMonthsAgo = () => {
    return dayjs().subtract(12, 'month');
  };

  // Navigation Handlers
  const handlePrevious = () => {
    const newMonth = currentMonth - 3;
    if (newMonth <= 0) {
      const newYear = currentYear - 1;
      const adjustedMonth = 12 + newMonth;
      
      // Check if the new date would be before 12 months ago
      const newDate = dayjs().year(newYear).month(adjustedMonth - 1);
      const twelveMonthsAgo = getTwelveMonthsAgo();
      
      if (newDate.isBefore(twelveMonthsAgo, 'month')) {
        return; // Don't navigate if it would go beyond 12 months
      }
      
      setCurrentMonth(adjustedMonth);
      setCurrentYear(newYear);
    } else {
      // Check if the new date would be before 12 months ago
      const newDate = dayjs().year(currentYear).month(newMonth - 1);
      const twelveMonthsAgo = getTwelveMonthsAgo();
      
      if (newDate.isBefore(twelveMonthsAgo, 'month')) {
        return; // Don't navigate if it would go beyond 12 months
      }
      
      setCurrentMonth(newMonth);
    }
  };

  const handleNext = () => {
    const newMonth = currentMonth + 3;
    if (newMonth > 12) {
      setCurrentMonth(newMonth - 12);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(newMonth);
    }
  };

  // Check if Previous Button should be Disabled
  const isPreviousDisabled = () => {
    const previousDate = dayjs().year(currentYear).month(currentMonth - 1).subtract(3, "month");
    const twelveMonthsAgo = getTwelveMonthsAgo();
    return previousDate.isBefore(twelveMonthsAgo, 'month');
  };

  // Check if Next Button should be Disabled
  const isNextDisabled = () => {
    const nextDate = dayjs().year(currentYear).month(currentMonth - 1).add(3, "month");
    return nextDate.isAfter(dayjs());
  };

  return (
    <div className="relative text-center h-auto lg:h-[13.5rem]">
      <div className="flex justify-center space-x-2 sm:space-x-4 flex-wrap lg:flex-nowrap">
        {renderHeatmap()}
      </div>
      <div className="flex justify-center lg:absolute lg:bottom-4 lg:right-4 mt-4 lg:mt-0">
        <button
          onClick={handlePrevious}
          className={`rounded-md mr-3 px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold ${
            isPreviousDisabled() 
              ? "bg-gray-400 text-gray-600 cursor-not-allowed" 
              : "bg-green-400 text-black hover:bg-green-500"
          }`}
          disabled={isPreviousDisabled()}
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className={`rounded-md px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold ${
            isNextDisabled() 
              ? "bg-gray-400 text-gray-600 cursor-not-allowed" 
              : "bg-green-400 text-black hover:bg-green-500"
          }`}
          disabled={isNextDisabled()}
        >
          Next
        </button>
      </div>
    </div>
  );

};

export default Heatmap;
