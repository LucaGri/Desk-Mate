import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function FinalCTA() {
  return (
    <section className="py-20 md:py-32 px-4 md:px-8">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight" data-testid="text-cta-headline">
          Ready to Transform Your Productivity?
        </h2>
        <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed" data-testid="text-cta-subtitle">
          Join thousands of professionals who trust Desk Mate to manage their time, meetings, and personal growth.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/auth?mode=register" data-testid="link-cta-primary">
            <Button size="lg" className="text-lg px-8" data-testid="button-cta-getstarted">
              Get Started Free
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="text-lg px-8" data-testid="button-cta-demo">
            Schedule a Demo
          </Button>
        </div>
        <p className="text-sm text-muted-foreground pt-4" data-testid="text-cta-note">
          No credit card required • 14-day free trial • Cancel anytime
        </p>
      </div>
    </section>
  );
}
