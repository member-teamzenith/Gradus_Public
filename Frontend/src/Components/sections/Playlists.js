"use client";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/Firebase";
import { useRouter } from "next/navigation";
import Navbar from "../common/Navbar";
import { API_URL } from "@/server";

function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await fetchPlaylists(user.uid);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Existing code inside Playlists component
  // useEffect(() => {
  //   console.log("Playlists state updated:", playlists);
  // }, [playlists]);



  const fetchPlaylists = async (uid) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/playlists/${uid}`);
      if (!response.ok) {
        setPlaylists([]);
        return;
      }
      const result = await response.json();
      const { playlists } = result;

      // Convert playlists object to array (safe & robust)
      const playlistsArray =
        playlists && typeof playlists === "object" && !Array.isArray(playlists)
          ? Object.entries(playlists).map(([id, playlist]) => ({ id, ...playlist }))
          : [];

      // Check for empty array
      if (!playlistsArray.length) {
        setPlaylists([]);
        return;
      }

      const formattedPlaylists = playlistsArray.map((playlist, i) => {
        let thumbnailUrl = playlist.thumbnail || playlist.playThumbnail || "";
        if (thumbnailUrl && typeof thumbnailUrl === "string") {
          const videoId = thumbnailUrl.match(/\/vi\/([^/]+)\//)
            ? thumbnailUrl.match(/\/vi\/([^/]+)\//)[1]
            : "";
          if (videoId) {
            thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }
        }
        return {
          ...playlist,
          id: playlist.id || i,
          name: playlist.name || playlist.playName || "Unknown Playlist",
          thumbnail: thumbnailUrl,
          videos: playlist.videos,
        };
      });

      setPlaylists(formattedPlaylists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };



  const handlePathwayClick = () => {
    router.push("/pathway");
  };

  const handlePlaylistClick = (playlistId) => {
    router.push(`/saved-playlist/${playlistId}`);
  };

  const handleDeleteMode = () => {
    setDeleteMode(!deleteMode);
    setSelectedPlaylists([]);
  };

  const handleCheckboxChange = (playlistId) => {
    setSelectedPlaylists(prev => {
      if (prev.includes(playlistId)) {
        return prev.filter(id => id !== playlistId);
      } else {
        return [...prev, playlistId];
      }
    });
  };

  const handleDeletePlaylists = async () => {
    if (!selectedPlaylists.length) return;

    try {
      const user = auth.currentUser;
      if (!user) return;

      // Delete each selected playlist via backend API
      for (const playlistId of selectedPlaylists) {
        const response = await fetch(`${API_URL}/delete-playlists/${user.uid}/${playlistId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          console.error(`Failed to delete playlist ${playlistId}`);
        }
      }

      // Remove deleted playlists from local state
      setPlaylists(prev => prev.filter(playlist => !selectedPlaylists.includes(playlist.id)));
      setSelectedPlaylists([]);
      setDeleteMode(false);
    } catch (error) {
      console.error("Error deleting playlists:", error);
    }
  };


  return (
    <div>
      <Navbar />
      <div className="bg-darkBlueGray relative top-16 min-h-screen h-auto">
        <div className="h-[13rem]">
          <h1 className="text-3xl text-green-300 relative top-3 ml-5">Create Playlist</h1>
          <div className="flex justify-center gap-4 relative top-16">
            <button
              onClick={handlePathwayClick}
              className="bg-white text-black text-2xl w-[15%] rounded-lg p-3"
            >
              Orion Study Blueprints
            </button>
          </div>
        </div>

        <hr className="w-[95%] relative left-10" />

        <div>
          <h2 className="text-green-300 text-3xl mt-5 mb-7 ml-7">Saved Playlists</h2>
          {loading ? (
            <p className="text-white font-bold relative left-10 text-3xl">Loading playlists...</p>
          ) : playlists.length === 0 ? (
            <p>No playlists found.</p>
          ) : (
            <div
              className="relative left-6 ml-1 grid grid-cols-4 gap-5"
            >
              {playlists.map((playlist) => (
                <div
                  className="border border-white rounded-lg relative"
                  key={playlist.id}
                  style={{ textAlign: "center" }}
                  onClick={deleteMode ? undefined : () => handlePlaylistClick(playlist.id)}
                >
                  {deleteMode && (
                    <input
                      type="checkbox"
                      className="absolute top-1 right-1 w-6 h-6 z-10"
                      checked={selectedPlaylists.includes(playlist.id)}
                      onChange={() => handleCheckboxChange(playlist.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}

                  <img
                    className="relative left-2 top-2 cursor-pointer"
                    src={playlist.thumbnail}
                    onError={(e) => {
                      if (e.target.src.includes('hqdefault.jpg')) {
                        e.target.src = `${playlist.thumbnail.replace('/hqdefault.jpg', '/mqdefault.jpg')}`;
                      }
                      else if (e.target.src.includes('mqdefault.jpg')) {
                        e.target.src = `${playlist.thumbnail.replace('/mqdefault.jpg', '/default.jpg')}`;
                      }
                      else {
                        e.target.src = '/default-thumbnail.jpg';
                      }
                    }}
                    alt={playlist.name}
                    style={{ width: "96%", borderRadius: "10px" }}
                  />
                  <p className="text-green-300 text-2xl mt-3">{playlist.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-full flex justify-end">
          <div className="flex gap-2 w-[19rem] relative mb-10 mt-5 mr-4">
            <button
              onClick={handleDeleteMode}
              className="bg-red-500 text-white  w-[100%] rounded-lg p-3 text-xl"
            >
              {deleteMode ? 'Cancel' : 'Delete Playlists'}
            </button>
            {deleteMode && selectedPlaylists.length > 0 && (
              <button
                onClick={handleDeletePlaylists}
                className="bg-red-700 text-white text-xl w-[100%] rounded-lg p-3"
              >
                Delete
              </button>
            )}
          </div>
        </div>


      </div>
    </div>

  );
}

export default Playlists;
