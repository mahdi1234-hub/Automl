import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 cta-bg-image opacity-15" />
      <div className="absolute inset-0 bg-gradient-radial from-transparent to-[#0F0F0E]" style={{ background: "radial-gradient(ellipse at center, transparent 0%, #0F0F0E 75%)" }} />
      <div className="relative z-10">
        <div className="text-center mb-8">
          <p className="section-label justify-center mb-4">Welcome Back</p>
          <h1 className="font-display text-3xl text-[#F5F0EB]">
            Sign in to <em className="gradient-copper italic">AutoML</em>
          </h1>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
