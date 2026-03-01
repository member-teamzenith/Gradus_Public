import React, { useState, useEffect } from "react";
import { getAvatars } from "@/services/authServices";

const Avatars = ({ onAvatarSelect, currentPhoto }) => {
  const [avatars, setAvatars] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState(currentPhoto || null);

  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        const avatarUrls = await getAvatars();
        setAvatars(avatarUrls);
      } catch (error) {
        console.error("Error fetching avatars:", error);
      }
    };
    fetchAvatars();
  }, []);

  // Update selectedAvatar when currentPhoto changes
  useEffect(() => {
    if (currentPhoto) {
      setSelectedAvatar(currentPhoto);
    }
  }, [currentPhoto]);

  const handleSelectAvatar = (url) => {
    setSelectedAvatar(url);
    if (onAvatarSelect) {
      onAvatarSelect(url);
    }
  };

  return (
    <>
      {/* Animation & hide horizontal scrollbar styles */}
      <style>
        {`
          .scale {
            -webkit-animation: scale 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
            animation: scale 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
          }
          @-webkit-keyframes scale {
            0% {
              -webkit-transform: scale(0);
              transform: scale(0);
              opacity: 1;
            }
            100% {
              -webkit-transform: scale(1);
              transform: scale(1);
              opacity: 1;
            }
          }
          @keyframes scale {
            0% {
              -webkit-transform: scale(0);
              transform: scale(0);
              opacity: 1;
            }
            100% {
              -webkit-transform: scale(1);
              transform: scale(1);
              opacity: 1;
            }
          }
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;     /* Firefox */
          }
        `}
      </style>
      <div className="flex gap-4 p-4 overflow-x-auto hide-scrollbar">
        {avatars.map((url, index) => (
          <img
            key={index}
            src={url}
            alt={`avatar-${index}`}
            className={`scale cursor-pointer w-24 h-24 rounded-full border-2 transition-transform duration-300 ${
              selectedAvatar === url
                ? "border-green-500 shadow-md shadow-green-400"
                : "hover:border-green-500"
            }`}
            onClick={() => handleSelectAvatar(url)}
          />
        ))}
      </div>
    </>
  );
};

export default Avatars;


