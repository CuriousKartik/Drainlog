"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useSimulation();

  const [email, setEmail] = useState<string>("kartikey@moes.gov.in");
  const [password, setPassword] = useState<string>("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>("");
  const [forgotSent, setForgotSent] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !email.includes("@")) {
      setError("Please enter a valid institutional email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const ok = login(email, password);
      if (ok) {
        router.push("/dashboard");
      } else {
        setError("Invalid credentials. Please verify your email and password.");
        setLoading(false);
      }
    }, 450);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotEmail && forgotEmail.includes("@")) {
      setForgotSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-text-primary font-mono flex flex-col justify-center items-center px-4 py-12">
      {/* Brand Monogram */}
      <Link href="/" className="mb-6 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-md bg-accent-black flex items-center justify-center text-white font-bold text-xs font-mono">
          JK
        </div>
        <span className="heading-display text-xl uppercase tracking-tight text-accent-black">
          JALKAL
        </span>
      </Link>

      {/* Login Card */}
      <div className="card w-full max-w-md bg-white border border-border-light rounded-lg p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="heading-display text-2xl text-text-primary">Sign In</h1>
          <p className="text-xs text-text-secondary mt-1 font-sans">
            Access the Delhi Catchment Urban Flood Nowcast platform.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-md bg-status-error-bg border border-status-error-text/30 text-status-error-text text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-mono block mb-1">Institutional Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-black transition-colors"
              placeholder="operator@moes.gov.in"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="label-mono">Password</label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[11px] text-text-secondary hover:text-text-primary underline"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-black transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary text-xs py-3 mt-2 font-semibold"
          >
            {loading ? "AUTHENTICATING..." : "SIGN IN TO DASHBOARD"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border-light text-center text-xs text-text-secondary">
          Don&apos;t have an operator account?{" "}
          <Link href="/signup" className="text-text-primary font-bold underline">
            Register here
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm bg-white border border-border-light rounded-lg p-6 shadow-lg">
            <h3 className="font-bold text-base mb-2">Password Reset Request</h3>
            {forgotSent ? (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Password reset link has been dispatched to <b>{forgotEmail}</b>. Please check your agency inbox.
                </p>
                <button
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSent(false);
                  }}
                  className="btn-primary w-full text-xs py-2"
                >
                  RETURN TO LOGIN
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Enter your registered institutional email to receive a recovery token.
                </p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-black"
                  placeholder="operator@moes.gov.in"
                  required
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    CANCEL
                  </button>
                  <button type="submit" className="btn-primary text-xs py-2 px-4">
                    SEND LINK
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

