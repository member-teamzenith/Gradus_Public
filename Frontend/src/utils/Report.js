'use client';

import React, { useState, useRef, useEffect } from 'react';
import { auth } from '@/lib/Firebase';
import { fetchUserDetails } from '@/services/userServices';
import { sendBugReport } from '@/services/report';
import { toast } from 'react-toastify';

const Report = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const fileInputRef = useRef(null);

  // Fetch user email on component mount
  useEffect(() => {
    const fetchEmail = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          // Try to get email from user details first
          try {
            const details = await fetchUserDetails(user.uid);
            setUserEmail(details?.email || user.email || '');
          } catch (err) {
            // Fallback to auth email if details fetch fails
            setUserEmail(user.email || '');
          }
        }
      } catch (error) {
        console.error('Error fetching user email:', error);
      }
    };
    fetchEmail();
  }, []);

  const captureScreenshot = async () => {
    setIsCapturing(true);
    try {
      // Wait a moment for the button to disappear from the DOM
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try using browser's native screenshot API first (modern browsers)
      if (typeof window !== 'undefined' && 'MediaDevices' in window && navigator.mediaDevices?.getDisplayMedia) {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { mediaSource: 'screen' },
            preferCurrentTab: true 
          });
          
          const video = document.createElement('video');
          video.srcObject = stream;
          video.play();
          
          await new Promise(resolve => {
            video.onloadedmetadata = resolve;
          });
          
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          
          stream.getTracks().forEach(track => track.stop());
          
          const dataUrl = canvas.toDataURL('image/png');
          setScreenshot(dataUrl);
          setIsOpen(true);
          setIsCapturing(false);
          return;
        } catch (nativeError) {
          console.log('Native screenshot failed, trying fallback:', nativeError);
        }
      }
      
      // Fallback: Dynamically import dom-to-image-more only on the client
      const domtoimage = (await import('dom-to-image-more')).default;
      
      // Use dom-to-image-more which handles modern CSS better
      const dataUrl = await domtoimage.toPng(document.body, {
        quality: 0.95,
        bgcolor: '#000000',
        skipFonts: true, // Skip external fonts to avoid CORS
        filter: (node) => {
          // Filter out the report button itself and scripts
          return node.tagName !== 'SCRIPT' && 
                 node.tagName !== 'STYLE' &&
                 !node.classList?.contains('report-button');
        },
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      });
      
      setScreenshot(dataUrl);
      setIsOpen(true);
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      // Open form anyway and allow manual upload
      setIsOpen(true);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleManualUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setScreenshot(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setScreenshot(null);
    setIssueDescription('');
  };

  const handleSend = async () => {
    if (!issueDescription.trim()) {
      toast.warning('Please describe the issue before sending.', { position: 'bottom-right' });
      return;
    }

    if (!userEmail) {
      toast.error('Unable to identify user email. Please make sure you are logged in.', { position: 'bottom-right' });
      return;
    }

    setIsSending(true);
    try {
      const reportData = {
        userEmail,
        description: issueDescription,
        screenshot: screenshot || null,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };

      await sendBugReport(reportData);
      
      toast.success('Bug report sent successfully! Thank you for your feedback.', { position: 'bottom-right' });
      handleClose();
    } catch (error) {
      console.error('Failed to send bug report:', error);
      toast.error('Failed to send bug report. Please try again later.', { position: 'bottom-right' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Report Button - Fixed at bottom right */}
      {!isOpen && !isCapturing && (
        <button
          onClick={captureScreenshot}
          className="report-button !fixed !bottom-6 !right-6 bg-black hover:bg-gray-900 text-white p-4 rounded-full shadow-2xl border-2 border-red-500 hover:border-red-400 transition-all duration-300 !z-[9999] group"
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
          title="Report an Issue"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-red-500 group-hover:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </button>
      )}

      {/* Capturing Loader */}
      {isCapturing && (
        <div 
          className="!fixed !bottom-6 !right-6 bg-black p-4 rounded-full shadow-2xl border-2 border-red-500 !z-[9999]"
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
        >
          <svg className="animate-spin h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Report Form - Shows after screenshot */}
      {isOpen && screenshot && (
        <div 
          className="!fixed !bottom-6 !right-6 bg-black/95 backdrop-blur-lg rounded-2xl shadow-2xl border-2 border-red-500 !z-[9999] w-96 max-w-[calc(100vw-3rem)]"
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-red-500/30">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-white font-semibold">Report Issue</h3>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {/* Screenshot Preview */}
            <div className="space-y-2">
              <label className="text-gray-300 text-sm font-medium">Screenshot:</label>
              
              {screenshot ? (
                <div className="relative">
                  <div className="border-2 border-red-500/30 rounded-lg overflow-hidden">
                    <img
                      src={screenshot}
                      alt="Screenshot"
                      className="w-full h-auto max-h-48 object-contain bg-gray-900"
                    />
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 w-full text-xs text-gray-400 hover:text-white transition-colors underline"
                  >
                    Replace screenshot
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-red-500/30 rounded-lg p-8 hover:border-red-500/50 transition-colors bg-gray-900/50"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-gray-400">Click to upload screenshot</span>
                      <span className="text-xs text-gray-600">Auto-capture failed, please upload manually</span>
                    </div>
                  </button>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleManualUpload}
                className="hidden"
              />
            </div>

            {/* Issue Description */}
            <div className="space-y-2">
              <label htmlFor="issue-description" className="text-gray-300 text-sm font-medium">
                Describe the Issue: <span className="text-red-500">*</span>
              </label>
              <textarea
                id="issue-description"
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Please describe what went wrong or what issue you encountered..."
                className="w-full bg-gray-900 text-white border border-red-500/30 rounded-lg p-3 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all resize-none h-32"
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-all font-medium border border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!issueDescription.trim() || isSending}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-all shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Report'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Report;
