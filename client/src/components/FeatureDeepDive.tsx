import { CheckCircle2 } from "lucide-react";
import meetingSummaryImage from "@assets/generated_images/meeting_summary_screenshot.png";
import chatInterfaceImage from "@assets/generated_images/ai_chat_interface.png";
import analyticsImage from "@assets/generated_images/analytics_dashboard_visualization.png";

const features = [
  {
    title: "Meeting Intelligence",
    description: "Never miss a detail from your meetings. Desk Mate automatically records, transcribes, and generates intelligent summaries with action items and key decisions.",
    bullets: [
      "Automatic transcription with speaker identification",
      "AI-generated summaries with key points",
      "Action items extraction and assignment",
      "Searchable meeting archive"
    ],
    image: meetingSummaryImage,
    imageAlt: "Meeting Summary Interface",
    imagePosition: "right"
  },
  {
    title: "Your Personal AI Assistant",
    description: "Chat with an AI that knows your schedule, remembers your meetings, and understands your journal entries. Get instant answers to questions about your work and life.",
    bullets: [
      "Full context of your calendar and meetings",
      "Access to all your journal entries",
      "Natural language queries",
      "Proactive suggestions and reminders"
    ],
    image: chatInterfaceImage,
    imageAlt: "AI Chat Interface",
    imagePosition: "left"
  },
  {
    title: "Analytics Dashboard",
    description: "Gain insights into how you spend your time. Visualize your productivity patterns, meeting efficiency, and task completion rates with beautiful, actionable analytics.",
    bullets: [
      "Time distribution analysis",
      "Meeting efficiency metrics",
      "Task completion trends",
      "Productivity insights and recommendations"
    ],
    image: analyticsImage,
    imageAlt: "Analytics Dashboard",
    imagePosition: "right"
  }
];

export default function FeatureDeepDive() {
  return (
    <section id="how-it-works" className="py-20 md:py-32 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-32">
        {features.map((feature, index) => (
          <div 
            key={index}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
              feature.imagePosition === "left" ? "lg:flex-row-reverse" : ""
            }`}
            data-testid={`section-feature-${index}`}
          >
            <div className={`space-y-6 ${feature.imagePosition === "left" ? "lg:order-2" : ""}`}>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight" data-testid={`text-feature-deep-title-${index}`}>
                {feature.title}
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed" data-testid={`text-feature-deep-description-${index}`}>
                {feature.description}
              </p>
              <ul className="space-y-3">
                {feature.bullets.map((bullet, bulletIndex) => (
                  <li key={bulletIndex} className="flex items-start gap-3" data-testid={`text-feature-bullet-${index}-${bulletIndex}`}>
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-base text-foreground">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={feature.imagePosition === "left" ? "lg:order-1" : ""}>
              <img 
                src={feature.image} 
                alt={feature.imageAlt}
                className="rounded-xl shadow-2xl w-full"
                data-testid={`img-feature-deep-${index}`}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
