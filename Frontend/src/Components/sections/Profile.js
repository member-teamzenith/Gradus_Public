"use client"
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, clearUser, updateUserFields, setUserDetails as setUserDetailsRedux, selectUserDetails } from '../../../store/userSlice';
import { useRouter } from "next/navigation";
import "@/Styles/profile.css";
import Dashboard from "../layout/Dashboard";
import Navbar from "../common/Navbar";
import ProfileLoader from "../loaders/ProfileLoader";
import Batches from "../layout/Batches";
import { fetchUserDetails, checkBadges, seedUserInReduxIfMissing } from "@/services/userServices";
import { auth } from "@/lib/Firebase";
import { sendUserIdToExtension } from "@/utils/userIdToExtension";
import NavbarWithSearch from "../common/NavbarWithSearch";

// ProfileContent component that accepts props
function ProfileContent({ userDetails, firstFlame, bugHunter, onLogout, onUpdateDetails }) {

    return (
        <>
            {/* Outer Container */}
            <div className="bg-darkBlueGray h-full px-2 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">

                {/* Mobile Layout - Stacked */}
                <div className="block xl:hidden space-y-4 sm:space-y-6">
                    {/* Profile Info Card */}
                    <div className="bg-darkBlueGray border border-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-center mx-auto max-w-md flex flex-col items-center justify-center">
                        <div className="bg-gray-500 w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4 sm:mb-6 border-4 border-green-400 rounded-full overflow-hidden flex items-center justify-center">
                            <Image className="w-full h-full object-cover bg-black" src={userDetails.photo} alt="User Profile" width={128} height={128} unoptimized />
                        </div>
                        <div className="text-white space-y-2 sm:space-y-3 text-center">
                            <p className="text-lg sm:text-2xl md:text-3xl font-bold text-green-300 break-words">
                                {userDetails.name} <span className="text-base sm:text-lg md:text-xl text-white">{userDetails.gender}</span>
                            </p>
                            <p className="text-sm sm:text-lg md:text-xl font-bold underline break-words">{userDetails.email}</p>
                            <p className="text-sm sm:text-lg md:text-xl font-bold">
                                Age: <span className="text-green-300">{userDetails.age}</span>
                            </p>
                        </div>
                        <button className={`button mt-2 sm:mt-3 mx-auto`} onClick={onUpdateDetails}>
                            Update Details
                        </button>

                    </div>

                    {/* Stats Cards */}
                    <div className="bg-darkBlueGray border border-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 mx-auto max-w-4xl">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 text-center">
                            <div className="text-white rounded-lg p-3 bg-gray-800/50">
                                <span className="font-bold text-green-400 text-base sm:text-lg md:text-xl">{userDetails?.videosInLastWeek || 0}</span>
                                <p className="text-xs sm:text-sm md:text-base">Videos in last week</p>
                            </div>
                            <div className="text-white rounded-lg p-3 bg-gray-800/50">
                                <span className="font-bold text-green-400 text-base sm:text-lg md:text-xl">{userDetails?.maxStreak || 0}</span>
                                <p className="text-xs sm:text-sm md:text-base">Max Streak (days)</p>
                            </div>
                            <div className="text-white rounded-lg p-3 bg-gray-800/50 sm:col-span-2 lg:col-span-1">
                                <span className="font-bold text-green-400 text-base sm:text-lg md:text-xl">{userDetails?.currentStreak || 0}</span>
                                <p className="text-xs sm:text-sm md:text-base">Current Streak (days)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                            <div className="text-center rounded-lg p-3 sm:p-4 bg-gray-800/50">
                                <p className="text-white text-sm sm:text-lg md:text-xl mb-2">Videos Watched</p>
                                <p className="text-green-400 text-xl sm:text-2xl md:text-3xl font-bold">{userDetails?.videosWatched || 0}</p>
                            </div>
                            <div className="text-center rounded-lg p-3 sm:p-4 bg-gray-800/50">
                                <p className="text-white text-sm sm:text-lg md:text-xl mb-2">Total Active Days</p>
                                <p className="text-green-400 text-xl sm:text-2xl md:text-3xl font-bold">{userDetails?.totalActiveDays || 0}</p>
                            </div>
                        </div>

                        {/* Heatmap Container */}
                        <div className="border border-green-400 rounded-lg p-2 sm:p-4">
                            <Dashboard />
                        </div>
                    </div>

                    {/* Badges Container - Mobile */}
                    <div className="bg-darkBlueGray border border-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 mx-auto max-w-4xl min-h-[200px] sm:min-h-[250px]">
                        <Batches firstFlame={firstFlame} bugHunter={bugHunter} />
                    </div>
                </div>

                {/* Desktop Layout - Original Grid */}
                <div className="hidden xl:block">
                    <div className="grid grid-cols-7 grid-rows-5 gap-4">
                        <div className="col-span-2 row-span-5 bg-darkBlueGray border border-white h-[35rem] relative top-5 left-4 rounded-3xl text-center flex flex-col items-center justify-center">
                            <div className="bg-gray-500 w-[10rem] h-[10rem] mx-auto mb-6 border-4 border-green-400 rounded-full overflow-hidden flex items-center justify-center">
                                <Image className="w-full h-full object-cover bg-black" src={userDetails.photo} alt="User Profile" width={160} height={160} unoptimized />
                            </div>
                            <div className="text-white text-center mb-6">
                                <p className="text-3xl font-bold mb-2 text-green-300">{userDetails.name} <span className="text-xl text-white">{userDetails.gender}</span></p>
                                <p className="text-xl font-bold underline mb-2">{userDetails.email}</p>
                                <p className="text-xl font-bold mb-2">Age: <span className="text-green-300">{userDetails.age}</span></p>
                            </div>
                            <button className={`button mx-auto`} onClick={onUpdateDetails}>
                                Update Details
                            </button>

                        </div>

                        <div className="col-span-5 row-span-3 col-start-3 bg-darkBlueGray border border-white h-[22rem] relative top-5 left-5 w-[95%] rounded-3xl">
                            <div className="grid grid-cols-6 grid-rows-1 gap-4 relative top-4 left-[18.5rem] w-[70%] text-center text-xl">
                                <div className="col-span-2 text-white h-[2.5rem] rounded-lg"><span className="font-bold text-green-400">{userDetails?.videosInLastWeek || 0}</span> Videos in last week</div>
                                <div className="col-span-2 text-white col-start-3  rounded-lg">Max Streak : <span className="font-bold text-green-400">{userDetails?.maxStreak || 0}</span> days</div>
                                <div className="col-span-2 text-white col-start-5  rounded-lg">Current Streak : <span className="font-bold text-green-400">{userDetails?.currentStreak || 0}</span> days</div>
                            </div>

                            <div className="grid grid-cols-7 grid-rows-4 gap-4 relative top-7">
                                <div className="col-span-2 row-span-2  rounded-lg relative left-4 w-[90%] text-center">
                                    <p className="w-full relative top-4 text-white text-2xl">Videos Watched</p>
                                    <p className="w-full relative top-5 text-green-400 text-4xl">{userDetails?.videosWatched || 0}</p>
                                </div>
                                <div className="col-span-2 row-span-2 col-start-1 row-start-3 rounded-lg relative left-4 bottom-4 w-[90%] text-center">
                                    <p className="w-full relative top-4 text-white text-2xl">Total Active Days</p>
                                    <p className="w-full relative top-5 text-4xl text-green-400">{userDetails?.totalActiveDays || 0}</p>
                                </div>

                                <div className="col-span-5 row-span-4 col-start-3 row-start-1 border border-green-400 h-[16rem] rounded-lg relative right-3 overflow-x-auto whitespace-nowrap p-4">
                                    <Dashboard />
                                </div>
                            </div>
                        </div>

                        {/* Badges Section - Desktop */}
                        <div className="col-span-5 row-span-2 col-start-3 row-start-4 bg-darkBlueGray border border-white h-[14rem] relative top-5 left-5 w-[95%] rounded-3xl flex items-center justify-center">
                            <Batches firstFlame={firstFlame} bugHunter={bugHunter} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}


function Profile() {
    const router = useRouter();
    const dispatch = useDispatch();
    const reduxUser = useSelector(selectUser);
    const reduxDetails = useSelector(selectUserDetails);
    const [userDetails, setUserDetails] = useState(null);
    const [firstFlame, setFirstFlame] = useState(false);
    const [bugHunter, setBugHunter] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const handleFetchUserDetails = async (user) => {
        if (!user) return;

        try {
            setIsLoading(true);
            const result = await fetchUserDetails(user.uid);
            // Unwrap payload: backend returns { data: {...user fields...} }
            const details = result?.data ? result.data : result;

            if (details) {
                setUserDetails(details);
                // Also store full details in Redux for global visibility
                try { dispatch(setUserDetailsRedux(details)); } catch (_) { }
                // Update Redux user with fresher fields from backend if they differ
                try {
                    const patch = {};
                    if (details?.name && details.name !== (reduxUser?.displayName || '')) {
                        patch.displayName = details.name;
                    }
                    if (details?.photo && details.photo !== (reduxUser?.photo || '')) {
                        patch.photo = details.photo;
                        if (details?.email && details.email !== (reduxUser?.email || '')) {
                            patch.email = details.email;
                        }
                        // Also store full details in Redux for global visibility
                        try { dispatch(setUserDetailsRedux(details)); } catch (_) { }
                    }
                } catch (_) { }
                // try { console.log('User details (profile):', details); } catch (_) {}

            } else {
                console.error(result?.error || "User not found");
            }

            // Fetch badges status (optional - don't break profile if badges fail)
            try {
                const badgesResult = await checkBadges(user.uid);
                setFirstFlame(badgesResult.firstFlame);
                setBugHunter(badgesResult.bugHunter);
                // console.log('Badges status:', badgesResult);
            } catch (error) {
                console.warn("Badges check failed (this is optional):", error.message);
                // Don't set badges to false here, just log the warning
                // This way the profile page still works even if badges endpoint is down
            }


        } catch (error) {
            console.error("Error fetching user data:", error.message);
        } finally {
            setIsLoading(false);
        }
    };


    // Drive profile by Redux user; ensure Redux is seeded from auth+backend if missing
    useEffect(() => {
        const run = async () => {
            // Try to seed Redux user if absent
            await seedUserInReduxIfMissing({ reduxUser, auth, dispatch });
            if (!reduxUser || !reduxUser.uid) {
                setIsLoading(false);
                router.push('/auth/login');
                return;
            }
            handleFetchUserDetails({ uid: reduxUser.uid });

            // Sync with extension
            sendUserIdToExtension(reduxUser.uid);
        };
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduxUser?.uid]);

    // Redirect to personal details if age is missing/empty
    useEffect(() => {
        if (!isLoading && userDetails) {
            const ageValue = userDetails?.age;
            const isMissing = ageValue === undefined || ageValue === null || String(ageValue).trim() === "";
            if (isMissing) {
                router.push('auth/onBoarding/personal-details');
            }
        }
    }, [isLoading, userDetails, router]);




    const handleLogout = async () => {
        try {
            // Clear Redux user and redirect
            dispatch(clearUser());
            router.push("/homepage");
        } catch (error) {
            console.error("Error logging out:", error.message);
        }
    };

    const handleUpdateDetails = () => {
        router.push("/auth/onBoarding/personal-details?update=true");
    };


    if (isLoading) {
        return (
            <div className="min-h-screen overflow-x-hidden overflow-y-auto">
                <NavbarWithSearch />
                <ProfileLoader />
            </div>
        );
    }

    // Merge redux user basic fields into details for display preference
    const mergedDetails = userDetails ? { ...userDetails } : null;
    if (mergedDetails) {
        const pick = (obj, keys) => {
            if (!obj) return undefined;
            for (const k of keys) {
                if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).length > 0) return obj[k];
            }
            return undefined;
        };
        const detailsPhoto = pick(reduxDetails, ['photo', 'photo', 'avatar', 'profilePic', 'profilePhoto', 'image', 'picture', 'photo(pin)']);
        const detailsName = pick(reduxDetails, ['displayName', 'name']);
        mergedDetails.name = reduxUser?.displayName || detailsName || userDetails?.name || userDetails?.displayName || '';
        mergedDetails.photo = reduxUser?.photo || detailsPhoto || pick(userDetails, ['photo', 'photo', 'avatar', 'profilePic', 'profilePhoto', 'image', 'picture', 'photo(pin)']) || '';
        mergedDetails.email = reduxUser?.email || userDetails?.email || '';
    }

    return (
        <div className="min-h-screen overflow-x-hidden overflow-y-auto">
            <NavbarWithSearch />
            {mergedDetails ? (
                <ProfileContent
                    userDetails={mergedDetails}
                    firstFlame={firstFlame}
                    bugHunter={bugHunter}
                    onLogout={handleLogout}
                    onUpdateDetails={handleUpdateDetails}
                />
            ) : (
                <p></p>
            )}
        </div>
    );
}

export default Profile;