
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/sections/Hero";
import { Products } from "@/components/sections/Products";
import { Testimonials } from "@/components/sections/Testimonials";
import { ConsultationForm } from "@/components/sections/ConsultationForm";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <div className="min-h-screen font-body selection:bg-accent selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <Products />
        <Testimonials />
        <ConsultationForm />
      </main>
      <Footer />
    </div>
  );
}
