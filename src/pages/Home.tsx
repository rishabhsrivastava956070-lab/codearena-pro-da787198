import { Link } from "react-router-dom";
import { ArrowRight, Code2, Cpu, Sparkles, Trophy, Users, Zap, BookOpen, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  { icon: Code2, title: "1000+ Problems", desc: "Crack curated challenges from easy to hard across data structures and algorithms." },
  { icon: Cpu, title: "Multi-language Editor", desc: "VS Code-grade Monaco editor with C++, Java, Python and JavaScript support." },
  { icon: Trophy, title: "Live Contests", desc: "Compete in real-time contests with live leaderboards and ICPC-style penalties." },
  { icon: Bot, title: "AI Code Review", desc: "Get instant complexity analysis and improvement hints from our AI mentor." },
  { icon: Users, title: "Peer Coding Rooms", desc: "Pair-program in real time. Share a room code, code together, ship faster." },
  { icon: Sparkles, title: "Gamification", desc: "Earn XP, build streaks, unlock badges. Make practice addictive (in a good way)." },
];

export default function Home() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute inset-0 -z-10 opacity-30 [background:radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.25),transparent_40%),radial-gradient(circle_at_80%_60%,hsl(var(--accent)/0.2),transparent_45%)]" />
        <div className="container py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3 w-3 text-primary" />
            Powered by AI · Built for engineers
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Code. Compete. <span className="bg-clip-text text-transparent gradient-primary">Conquer.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            The modern coding platform for ambitious engineers. Practice, compete in contests,
            collaborate in real-time, and level up with AI feedback.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="shadow-glow">
              <Link to="/problems">
                Start solving <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/contests">
                <Trophy className="mr-1 h-4 w-4" /> Join a contest
              </Link>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { n: "1k+", l: "Problems" },
              { n: "50+", l: "Contests" },
              { n: "10k+", l: "Coders" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border border-border bg-card/50 px-4 py-3">
                <div className="text-2xl md:text-3xl font-bold">{s.n}</div>
                <div className="text-xs text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need to grow</h2>
          <p className="mt-3 text-muted-foreground">A complete training ground for software engineers.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-6 hover:border-primary/40 transition-colors group">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-12 text-center shadow-card">
          <Zap className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold">Ready to crack your next interview?</h2>
          <p className="mt-2 text-muted-foreground">Free to start. No credit card needed.</p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/auth?mode=signup">
              Create your account <BookOpen className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}