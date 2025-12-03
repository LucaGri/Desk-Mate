import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Product Manager",
    content: "Desk Mate has transformed how I manage my day. The AI summaries save me hours every week, and I never miss action items anymore.",
    initials: "SJ"
  },
  {
    name: "Michael Chen",
    role: "Engineering Lead",
    content: "The contextual chat feature is incredible. I can ask about any meeting from the past month and get instant, accurate answers.",
    initials: "MC"
  },
  {
    name: "Emma Williams",
    role: "Executive Coach",
    content: "The journal feature combined with analytics has given me unprecedented insight into my productivity patterns. Game changer!",
    initials: "EW"
  }
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-20 md:py-32 px-4 md:px-8 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight" data-testid="text-testimonials-headline">
            Loved by Professionals Worldwide
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-testimonials-subtitle">
            See what our users have to say about their experience with Desk Mate.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="hover-elevate transition-all" data-testid={`card-testimonial-${index}`}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-1" data-testid={`rating-${index}`}>
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-base text-foreground" data-testid={`text-testimonial-content-${index}`}>
                  "{testimonial.content}"
                </p>
                <div className="flex items-center gap-3 pt-4">
                  <Avatar data-testid={`avatar-${index}`}>
                    <AvatarFallback>{testimonial.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm" data-testid={`text-testimonial-name-${index}`}>{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-testimonial-role-${index}`}>{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
