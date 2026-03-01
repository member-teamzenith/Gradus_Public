"use client"

import React, { Children, useEffect } from "react"
import { Provider } from "react-redux"
import { PersistGate } from "redux-persist/integration/react"
import store from "../store/store"
import persistStore from "redux-persist/es/persistStore"
import MobileDetector from "../src/lib/MobileDetector"
import useCleanupOnClose from "../src/hooks/useCleanupOnClose"
import { runMigrationCycle } from "../src/pythonServices/VideoPlayerServices"
import { auth } from "../src/lib/Firebase"
import { onAuthStateChanged } from "firebase/auth"
import { sendUserIdToExtension } from "../src/utils/userIdToExtension"
import Report from "../src/utils/Report"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { usePathname } from "next/navigation"

const persistor = persistStore(store);

// Inner component that uses the cleanup hook
const CleanupWrapper = ({ children }) => {
    const pathname = usePathname();
    useCleanupOnClose(); // This hook will handle cleanup on browser close

    // Check if current page should hide the Report button
    const shouldHideReport = pathname === '/' ||
        pathname === '/homepage' ||
        pathname === '/extension' ||
        pathname?.startsWith('/auth/');

    // Check if current page should hide the Mobile Detector popup
    const shouldHideMobileDetector = pathname === '/' ||
        pathname === '/homepage' ||
        pathname?.startsWith('/auth/');

    // Initialize migration scheduler on app start
    useEffect(() => {
        // console.log('Starting migration scheduler (every 4 hours)...');

        // Set up 4-hour interval (4 * 60 * 60 * 1000 ms)
        const intervalId = setInterval(() => {
            runMigrationCycle().catch(error => {
                console.error('Scheduled migration cycle failed:', error);
            });
        }, 4 * 60 * 60 * 1000);

        // Cleanup on unmount
        return () => {
            // console.log('Stopping migration scheduler...');
            clearInterval(intervalId);
        };
    }, []);

    // Sync auth state with extension
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // console.log('Syncing user ID with extension:', user.uid);
                sendUserIdToExtension(user.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    return (
        <>
            {shouldHideMobileDetector ? (
                children
            ) : (
                <MobileDetector>
                    {children}
                </MobileDetector>
            )}
            {/* Report Button - Available on all pages except landing, auth, and onboarding */}
            {!shouldHideReport && <Report />}
        </>
    );
};

const ClientProvider = ({ children }) => {
    return (
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                <CleanupWrapper>
                    {children}
                    {/* Toast Container for notifications */}
                    <ToastContainer />
                </CleanupWrapper>
            </PersistGate>
        </Provider>
    )
}

export default ClientProvider;