import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowUpRight, FiShoppingBag, FiCalendar, FiCoffee, FiBook, FiCpu, FiHeart, FiShield } from "react-icons/fi";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";

const useCases = [
  { icon: FiShoppingBag, title: "Retail", body: "Read customer demographics and mood in real time to sharpen merchandising, layout and staffing." },
  { icon: FiCalendar, title: "Events", body: "Track attendee make-up and engagement live, then analyse what landed once the doors close." },
  { icon: FiCoffee, title: "Hospitality", body: "Sense guest sentiment to prompt timely service and tune operations around real peak times." },
  { icon: FiBook, title: "Cultural venues", body: "Understand visitor flow through galleries and exhibits to plan space and programming." },
];

const offers = [
  { icon: FiCpu, title: "State-of-the-art analysis", body: "Computer-vision models detect faces and score age, gender and emotion frame by frame — accurately and on the edge." },
  { icon: FiHeart, title: "Comprehensive insight", body: "Beyond raw counts: behaviour patterns, sentiment trends and timing, visualised in intuitive charts." },
  { icon: FiShield, title: "Private by design", body: "FaceSense recognises no one. It stores no faces — only anonymous, aggregated numbers." },
];

const Section = ({ children, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5 }}
    className={className}
  >
    {children}
  </motion.div>
);

export const About = () => {
  return (
    <main className="overflow-hidden">
      {/* Mission */}
      <section className="container py-16 lg:py-24">
        <div className="max-w-3xl">
          <Badge>Our mission</Badge>
          <h1 className="mt-5 text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Turning how a space <span className="text-primary">feels</span> into something you can measure
          </h1>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
            FaceSense helps businesses understand visitors without compromising their privacy.
            We translate live video into anonymous insight — age, gender and emotion — so you can
            make confident, data-driven decisions about your physical spaces.
          </p>
        </div>
      </section>

      {/* What we offer */}
      <section className="border-y border-border bg-secondary/20">
        <div className="container py-20">
          <Section className="max-w-xl">
            <Badge>What we offer</Badge>
            <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">Built for clarity, not surveillance</h2>
          </Section>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {offers.map((o) => (
              <Card key={o.title} className="p-7">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><o.icon size={18} /></span>
                <h3 className="mt-5 text-xl font-semibold">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="container py-20">
        <Section className="max-w-xl">
          <Badge>Where it works</Badge>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">One platform, many spaces</h2>
        </Section>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((u) => (
            <Card key={u.title} className="group p-7 transition-shadow hover:shadow-lift">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-foreground text-background transition-colors group-hover:bg-primary"><u.icon size={18} /></span>
              <h3 className="mt-5 text-lg font-semibold">{u.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{u.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-16 text-background sm:px-16">
          <div className="pointer-events-none absolute -left-20 -bottom-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">Ready to see it live?</h2>
            <p className="mt-4 text-lg text-background/70">Explore the dashboard or talk to the team about your deployment.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-primary text-primary-foreground"><NavLink to="/service">Open dashboard <FiArrowUpRight /></NavLink></Button>
              <Button asChild size="lg" variant="outline" className="border-background/30 text-background hover:bg-background/10"><NavLink to="/contact">Contact us</NavLink></Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
