import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import FeaturesGrid from "@/components/FeaturesGrid";
import FeatureDeepDive from "@/components/FeatureDeepDive";
import Testimonials from "@/components/Testimonials";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <HeroSection />
        <FeaturesGrid />
        <FeatureDeepDive />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
