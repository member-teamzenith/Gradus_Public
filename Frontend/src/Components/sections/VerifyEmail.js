"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/Firebase";
import { sendEmailVerification } from "firebase/auth";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MailCheck, RotateCw, ArrowLeft } from "lucide-react";

const RESEND_COOLDOWN = 30; // seconds

export default function VerifyEmail() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState("");
	const [isResending, setIsResending] = useState(false);
		const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
		const [checking, setChecking] = useState(false);

		// Initialize email from query or localStorage; also start initial cooldown
		useEffect(() => {
		const q = searchParams?.get("email") || "";
		if (q) setEmail(q);
		else {
			try {
				const raw = localStorage.getItem("registration");
				if (raw) {
					const data = JSON.parse(raw);
					if (data?.email) setEmail(data.email);
				}
			} catch (_) {}
		}
		}, [searchParams]);

	// Count down cooldown
	useEffect(() => {
		if (cooldown <= 0) return;
		const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
		return () => clearInterval(id);
	}, [cooldown]);

	const canResend = useMemo(() => cooldown === 0 && !isResending, [cooldown, isResending]);

		// Poll for verification status and redirect when verified
		useEffect(() => {
			let timerId;
			const checkVerified = async () => {
				try {
					setChecking(true);
					const user = auth.currentUser;
					if (!user) return; // wait until session exists
					await user.reload();
					if (user.emailVerified) {
						toast.success("Email verified! Redirecting...", { position: "bottom-center" });
						router.push("/auth/onBoarding/personal-details");
					}
				} catch (_) {
					// ignore transient errors
				} finally {
					setChecking(false);
				}
			};
			// Initial slight delay to avoid racing with login redirect
			timerId = setInterval(checkVerified, 4000);
			// Run one immediate check as well
			checkVerified();
			return () => clearInterval(timerId);
		}, [router]);

	const handleResend = async () => {
		try {
			if (!auth.currentUser) {
				// Attempt to prompt user: they might have been signed out after registration
				toast.info("We will resend using your newly created account.", { position: "bottom-center" });
			}
			setIsResending(true);
			// Try to send from current user if available
			if (auth.currentUser) {
				await sendEmailVerification(auth.currentUser);
			} else {
				// If user is not signed-in (common after redirect), we cannot invoke sendEmailVerification directly.
				// Instead, rely on the original verification email, or ask them to try registering again.
				// Here we just show a helpful message.
				throw new Error("Session expired. Please log in and try resending from profile.");
			}
			toast.success("Verification email sent. Check inbox and spam.", { position: "bottom-center" });
			setCooldown(RESEND_COOLDOWN);
		} catch (err) {
			toast.error(err?.message || "Unable to resend verification email", { position: "bottom-center" });
		} finally {
			setIsResending(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black px-4">
			<div className="w-full max-w-md">
				<div className="bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
					<div className="relative h-32 border-b-2 border-green-200 flex items-center justify-center">
						<div className="absolute inset-0 opacity-20 bg-[url('/grid-pattern.svg')]"></div>
						<div className="flex items-center z-10">
							<img className="w-60 h-20" src='https://res.cloudinary.com/dlsgdlo8u/image/upload/v1742127578/gradus_logo-rbg_wuzawn.png' alt="Logo" width={150} height={70} />
						</div>
					</div>

					<div className="px-8 py-8">
						<div className="flex items-center justify-center mb-4">
							<MailCheck className="text-[#18cb96] w-8 h-8" />
						</div>
						<h2 className="text-2xl font-bold text-white text-center mb-2">Verify your email</h2>
						<p className="text-gray-300 text-center mb-6">
							We sent a verification link to {email || "your email"}. Check your inbox and spam folder.
						</p>


						<button
							type="button"
							onClick={handleResend}
							disabled={!canResend}
							className="w-full bg-[#18cb96] hover:bg-[#15b789] text-white font-medium py-3 rounded-lg shadow-lg hover:shadow-[#18cb9640] transition-all duration-300 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
						>
							{isResending ? (
								<>
									<svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
									</svg>
									Resending...
								</>
							) : cooldown > 0 ? (
								`Resend in ${cooldown}s`
							) : (
								<>
									<RotateCw className="w-5 h-5 mr-2" /> Resend email
								</>
							)}
						</button>

						<button
							type="button"
							onClick={() => router.push(email ? `/auth/register?email=${encodeURIComponent(email)}` : "/auth/register")}
							className="w-full mt-3 bg-transparent border border-[#18cb96] text-[#18cb96] hover:bg-[#18cb96] hover:text-white font-medium py-3 rounded-lg transition-all duration-300 flex items-center justify-center"
						>
							<ArrowLeft className="w-5 h-5 mr-2" /> Go back
						</button>
					</div>
				</div>

				<p className="text-gray-500 text-center mt-6 text-sm">If you still can&apos;t find the email, add us to your contacts and try again.</p>
				<ToastContainer />
			</div>
		</div>
	);
}