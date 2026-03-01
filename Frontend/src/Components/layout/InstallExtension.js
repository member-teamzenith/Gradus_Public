"use client";
import React from 'react';

const InstallExtension = ({ open, onClose }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[1002] bg-black bg-opacity-70 flex items-center justify-center">
            <div className="relative bg-[#0b0b0b] text-white rounded-2xl shadow-xl w-full max-w-md border border-white/20">
                <div className="p-6 flex flex-col items-center text-center">
                    <img
                        src="/Chill.png"
                        alt="Install Extension"
                        className="w-40 h-40 object-contain mb-4"
                    />
                    <h2 className="text-xl font-semibold mb-2">Extension Required</h2>
                    <p className="text-white/80 mb-5">
                        Seems like the extension is not installed.
                    </p>
                    <a
                        href={'https://chromewebstore.google.com/detail/gradus/bokpgjjcigbcpbbnilnajknlhgficppk?utm_source=item-share-cb'}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full px-5 py-3 bg-green-400 text-black font-medium hover:bg-green-500 transition-colors"
                    >
                        Install Extension
                    </a>
                </div>
            </div>
        </div>
    );
};

export default InstallExtension;


