"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useSimulation();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [organization, setOrganization] = useState<string>("Delhi Municipal Corporation");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please provide your full operator name.");
      return;
    }
    if (!email || !email.includes("@")) {
      setError("Please provide a valid agency email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const ok = signup(name, email, organization, password);
      if (ok) {
        router.push("/dashboard");
      } else {
        setError("Failed to register account. Please check input parameters.");
        setLoading(false);
      }
    }, 450);
  };

  return (
    <div className="min-h-screen bg-cream text-text-primary font-mono flex flex-col justify-center items-center px-4 py-12">
      {/* Brand */}
      <Link href="/" className="mb-6 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-md bg-accent-black flex items-center justify-center text-white font-bold text-xs font-mono">
          JK
        </div>
        <span className="heading-display text-xl uppercase tracking-tight text-accent-black">
          JALKAL
        </span>
      </Link>

      {/* Signup Card */}
      <div className="card w-full max-w-md bg-white border border-border-light rounded-lg p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="heading-display text-2xl text-text-primary">Operator Registration</h1>
          <p className="text-xs text-text-secondary mt-1 font-sans">
            Create an operational telemetry account for the Delhi drainage basin.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-md bg-status-error-bg border border-status-error-text/30 text-status-error-text text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-mono block mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-black"
              placeholder="e.g. Kartikey Gupta"
              required
            />
          </div>

          <div>
            <label className="label-mono block mb-1">Institutional Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-black"
              placeholder="operator@moes.gov.in"
              required
            />
          </div>

          <div>
            <label className="label-mono block mb-1">Department / Organization</label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-black"
              placeholder="Delhi Municipal Corporation"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mono block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-black"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="label-mono block mb-1">Confirm</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-black"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary text-xs py-3 mt-2 font-semibold"
          >
            {loading ? "CREATING ACCOUNT..." : "REGISTER OPERATOR ACCOUNT"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border-light text-center text-xs text-text-secondary">
          Already registered?{" "}
          <Link href="/login" className="text-text-primary font-bold underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

