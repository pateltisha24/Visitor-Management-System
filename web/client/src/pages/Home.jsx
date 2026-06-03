import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiArrowUpRight, FiVideo, FiCpu, FiBarChart2, FiUsers,
  FiSmile, FiClock, FiShield, FiZap,
} from "react-icons/fi";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { DashboardPreview } from "../components/marketing/DashboardPreview";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

const steps = [
  { icon: FiVideo, title: "Connect any camera", body: "Point a webcam or existing CCTV/RTSP stream at your space. No new hardware." },
  { icon: FiCpu, title: "Analyse on the edge", body: "Faces are detected and scored for age, gender and emotion in real time — frames never leave the room." },
  { icon: FiBarChart2, title: "Decide from the dashboard", body: "Aggregated, anonymous insight streams to a live dashboard you can read at a glance." },
];

const features = [
  { icon: FiUsers, title: "Footfall & groups", body: "Counts of visitors, split by individuals vs. groups, over any day." },
  { icon: FiSmile, title: "Sentiment", body: "Seven-way emotion read so you know how the room actually feels." },
  { icon: FiClock, title: "Emotion over time", body: "See mood shift hour by hour to find your best and worst windows." },
  { icon: FiShield, title: "Private by design", body: "No identity, no recognition, no stored faces — only anonymous aggregates." },
];

export const Home = () => {
  return (
    <main className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 dotted opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="container grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <FiZap size={12} /> Real-time visitor intelligence
              </Badge>
            </motion.div>
            <motion.h1
              variants={fadeUp} initial="hidden" animate="show" custom={1}
              className="mt-5 text-balance font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
            >
              Read the room,
              <span className="text-primary"> in real time.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp} initial="hidden" animate="show" custom={2}
              className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              FaceSense turns any camera into a stream of anonymous insight —
              age, gender and sentiment — so retail, events and venues can see
              who's visiting and how they feel, the moment it happens.
            </motion.p>
            <motion.div
              variants={fadeUp} initial="hidden" animate="show" custom={3}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button asChild size="lg">
                <NavLink to="/register">Get started <FiArrowUpRight /></NavLink>
              </Button>
              <Button asChild size="lg" variant="outline">
                <NavLink to="/about">See how it works</NavLink>
              </Button>
            </motion.div>
            <motion.div
              variants={fadeUp} initial="hidden" animate="show" custom={4}
              className="mt-8 flex items-center gap-6 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-2"><FiZap className="text-primary" /> 25+ FPS inference</span>
              <span className="flex items-center gap-2"><FiShield className="text-primary" /> No faces stored</span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border bg-secondary/30">
        <div className="container grid grid-cols-2 gap-8 py-10 md:grid-cols-4">
          {[
            { k: "3", l: "Analysis dimensions" },
            { k: "7", l: "Emotions detected" },
            { k: "25+", l: "Frames / second" },
            { k: "24/7", l: "Continuous capture" },
          ].map((s) => (
            <div key={s.l} className="text-center md:text-left">
              <div className="font-mono text-3xl font-semibold tracking-tight text-foreground">{s.k}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container py-20">
        <div className="max-w-2xl">
          <Badge>How it works</Badge>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            From camera to clarity in three steps
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card className="h-full p-7">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <s.icon size={18} />
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-secondary/20">
        <div className="container py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <Badge>What you get</Badge>
              <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                Everything happening in your space, quantified
              </h2>
            </div>
            <Button asChild variant="outline"><NavLink to="/service">View a live dashboard <FiArrowUpRight /></NavLink></Button>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title} className="group p-7 transition-shadow hover:shadow-lift">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-foreground text-background transition-colors group-hover:bg-primary">
                  <f.icon size={18} />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-16 text-background sm:px-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Start reading your space today
            </h2>
            <p className="mt-4 text-lg text-background/70">
              Spin up an account, connect a camera, and watch the insights arrive live.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-primary text-primary-foreground">
                <NavLink to="/register">Create account <FiArrowUpRight /></NavLink>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-background/30 text-background hover:bg-background/10">
                <NavLink to="/contact">Talk to us</NavLink>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
