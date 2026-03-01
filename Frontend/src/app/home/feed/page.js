"use client";
import VideoPage from "@/Components/HomePage/VideoPage";
import { useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import NavbarWithSearch from "@/Components/common/NavbarWithSearch";
import Loader from "@/Components/common/Loader";

const HomeComponent = () => {
  const [videosReady, setVideosReady] = useState(false);
  const showContent = videosReady;
  const searchParams = useSearchParams();
  const zone = searchParams.get("zone");

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      <NavbarWithSearch />
      <VideoPage zone={zone} onLoaded={() => setVideosReady(true)} />
    </div>
  );


}

const Home = () => {

  return (<Suspense fallback={<Loader />}>
    <HomeComponent />
  </Suspense>)

}

export default Home;

