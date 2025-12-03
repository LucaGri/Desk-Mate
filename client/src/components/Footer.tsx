import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <img src="/logo.png" alt="Desk Mate" className="h-8 mb-4" data-testid="img-footer-logo" />
            <p className="text-sm text-muted-foreground" data-testid="text-footer-tagline">
              Your AI assistant for peak productivity.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4" data-testid="text-footer-product-heading">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover-elevate inline-block" data-testid="link-footer-features">Features</a></li>
              <li><a href="#" className="hover-elevate inline-block" data-testid="link-footer-pricing">Pricing</a></li>
              <li><a href="#" className="hover-elevate inline-block" data-testid="link-footer-integrations">Integrations</a></li>
              <li><a href="#" className="hover-elevate inline-block" data-testid="link-footer-changelog">Changelog</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4" data-testid="text-footer-company-heading">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover-elevate inline-block" data-testid="link-footer-about">About</a></li>
              <li><a href="#" className="hover-elevate inline-block" data-testid="link-footer-blog">Blog</a></li>
              <li><a href="#" className="hover-elevate inline-block" data-testid="link-footer-careers">Careers</a></li>
              <li><a href="#" className="hover-elevate inline-block" data-testid="link-footer-contact">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4" data-testid="text-footer-newsletter-heading">Newsletter</h3>
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-footer-newsletter-description">
              Get productivity tips and updates.
            </p>
            <div className="flex gap-2">
              <Input 
                type="email" 
                placeholder="your@email.com" 
                className="text-sm"
                data-testid="input-newsletter"
              />
              <Button size="sm" data-testid="button-newsletter">Subscribe</Button>
            </div>
          </div>
        </div>
        
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p data-testid="text-footer-copyright">© 2024 desk-mate.it. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover-elevate" data-testid="link-footer-privacy">Privacy Policy</a>
            <a href="#" className="hover-elevate" data-testid="link-footer-terms">Terms of Service</a>
            <a href="#" className="hover-elevate" data-testid="link-footer-cookies">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
