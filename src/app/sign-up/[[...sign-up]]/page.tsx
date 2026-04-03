import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 cta-bg-image opacity-15" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 0%, #0F0F0E 75%)" }} />
      <div className="relative z-10">
        <div className="text-center mb-8">
          <p className="section-label justify-center mb-4">Get Started</p>
          <h1 className="font-display text-3xl text-[#F5F0EB]">
            Join <em className="gradient-copper italic">AutoML</em>
          </h1>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
