import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import heroImage from "@assets/generated_images/desk_mate_dashboard_hero.png";

export default function HeroSection() {
  return (
    <section className="min-h-[80vh] flex items-center pt-20 md:pt-32 pb-20 px-4 md:px-8">
      <div className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <Badge variant="secondary" className="w-fit" data-testid="badge-trust">
              <CheckCircle2 className="h-3 w-3 mr-2" />
              Trusted by 1,000+ professionals
            </Badge>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight" data-testid="text-hero-headline">
              Your AI Assistant for{" "}
              <span className="text-primary">Peak Productivity</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed" data-testid="text-hero-subtitle">
              Desk Mate intelligently manages your time, summarizes meetings, maintains your personal journal, and provides contextual chat support—all powered by AI.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/auth?mode=register" data-testid="link-hero-cta-primary">
                <Button size="lg" className="text-lg px-8" data-testid="button-hero-getstarted">
                  Get Started Free
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8" data-testid="button-hero-demo">
                Watch Demo
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground" data-testid="text-hero-note">
              No credit card required • Free 14-day trial
            </p>
          </div>
          
          <div className="relative">
            <img 
              src={heroImage} 
              alt="Desk Mate Dashboard" 
              className="rounded-xl shadow-2xl w-full"
              data-testid="img-hero"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
