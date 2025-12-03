import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Calendar, BookOpen, MessageSquare } from "lucide-react";

const features = [
  {
    icon: Mic,
    title: "AI Meeting Summaries",
    description: "Automatically transcribe and summarize your meetings with key points, action items, and decisions highlighted.",
    link: "#"
  },
  {
    icon: Calendar,
    title: "Smart Time Management",
    description: "Intelligent calendar integration with Google Calendar sync, automated scheduling, and productivity insights.",
    link: "#"
  },
  {
    icon: BookOpen,
    title: "Personal Journal",
    description: "Capture your thoughts, track your mood, and build a searchable knowledge base of your daily experiences.",
    link: "#"
  },
  {
    icon: MessageSquare,
    title: "Contextual Chat",
    description: "Ask questions about your schedule, past meetings, and journal entries—your AI assistant has full context.",
    link: "#"
  }
];

export default function FeaturesGrid() {
  return (
    <section id="features" className="py-20 md:py-32 px-4 md:px-8 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight" data-testid="text-features-headline">
            Everything You Need to Stay Productive
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-features-subtitle">
            Desk Mate combines powerful AI with intuitive design to help you manage your work and life seamlessly.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="hover-elevate transition-all" data-testid={`card-feature-${index}`}>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4" data-testid={`icon-feature-${index}`}>
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl" data-testid={`text-feature-title-${index}`}>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base" data-testid={`text-feature-description-${index}`}>
                  {feature.description}
                </CardDescription>
                <a href={feature.link} className="text-primary text-sm font-medium mt-4 inline-block hover-elevate" data-testid={`link-feature-learn-${index}`}>
                  Learn more →
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
