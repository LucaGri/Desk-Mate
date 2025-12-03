import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" data-testid="link-home">
            <img src="/logo.png" alt="Desk Mate" className="h-8 md:h-10" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-foreground hover-elevate px-3 py-2 rounded-md text-sm font-medium" data-testid="link-features">
              Features
            </a>
            <a href="#how-it-works" className="text-foreground hover-elevate px-3 py-2 rounded-md text-sm font-medium" data-testid="link-how-it-works">
              How It Works
            </a>
            <a href="#testimonials" className="text-foreground hover-elevate px-3 py-2 rounded-md text-sm font-medium" data-testid="link-testimonials">
              Testimonials
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth?mode=login" data-testid="link-signin">
              <Button variant="ghost" data-testid="button-signin">Login</Button>
            </Link>
            <Link href="/auth?mode=register" data-testid="link-getstarted">
              <Button data-testid="button-getstarted">Get Started</Button>
            </Link>
          </div>

          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-4 py-4 space-y-3">
            <a href="#features" className="block px-3 py-2 text-foreground hover-elevate rounded-md" data-testid="link-mobile-features">
              Features
            </a>
            <a href="#how-it-works" className="block px-3 py-2 text-foreground hover-elevate rounded-md" data-testid="link-mobile-how-it-works">
              How It Works
            </a>
            <a href="#testimonials" className="block px-3 py-2 text-foreground hover-elevate rounded-md" data-testid="link-mobile-testimonials">
              Testimonials
            </a>
            <div className="pt-4 space-y-2">
              <Link href="/auth?mode=login" className="block" data-testid="link-mobile-signin">
                <Button variant="ghost" className="w-full" data-testid="button-mobile-signin">Login</Button>
              </Link>
              <Link href="/auth?mode=register" className="block" data-testid="link-mobile-getstarted">
                <Button className="w-full" data-testid="button-mobile-getstarted">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
